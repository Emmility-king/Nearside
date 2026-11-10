create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Nearside member'
    check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint connections_distinct_users check (requester_id <> recipient_id),
  constraint connections_inviter_is_participant check (invited_by = requester_id)
);

create unique index connections_one_relationship_per_pair
  on public.connections (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index connections_requester_status on public.connections (requester_id, status);
create index connections_recipient_status on public.connections (recipient_id, status);

create table public.invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

create table public.sharing_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  started_at timestamptz not null default now()
);
alter table public.sharing_sessions enable row level security;
create policy "Users can read their own sharing session"
  on public.sharing_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.sharing_sessions to authenticated;
revoke insert, update, delete on public.sharing_sessions from anon, authenticated;

create table public.current_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m between 0 and 100000),
  recorded_at timestamptz not null default now()
);
alter table public.current_locations enable row level security;

create table public.location_retention (
  user_id uuid primary key references auth.users (id) on delete cascade,
  delete_after timestamptz not null
);
alter table public.location_retention enable row level security;
revoke all on public.location_retention from anon, authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

create function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = (select auth.uid()) and c.recipient_id = p_profile_id)
          or (c.recipient_id = (select auth.uid()) and c.requester_id = p_profile_id)
        )
    )
    or exists (
      select 1
      from public.connections c
      where c.status = 'pending'
        and c.recipient_id = (select auth.uid())
        and c.requester_id = p_profile_id
    );
$$;

create function public.can_view_location(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner_id = (select auth.uid())
    or exists (
      select 1
      from public.sharing_sessions s
      join public.connections c
        on c.status = 'accepted'
       and (
         (c.requester_id = p_owner_id and c.recipient_id = (select auth.uid()))
         or (c.recipient_id = p_owner_id and c.requester_id = (select auth.uid()))
       )
      where s.user_id = p_owner_id
        and s.expires_at > now()
        and exists (
          select 1
          from public.current_locations l
          where l.user_id = p_owner_id
            and l.recorded_at > now() - interval '2 minutes'
        )
    );
$$;

alter table public.profiles enable row level security;
create policy "Users can read profiles in their circle"
  on public.profiles for select to authenticated
  using ((select public.can_view_profile(id)));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

alter table public.connections enable row level security;
create policy "Users can read their own connections"
  on public.connections for select to authenticated
  using (
    (select auth.uid()) = recipient_id
    or ((select auth.uid()) = requester_id and status = 'accepted')
  );
grant select on public.connections to authenticated;
revoke insert, update, delete on public.connections from anon, authenticated;

create policy "Only the owner or an approved viewer can read a location"
  on public.current_locations for select to authenticated
  using ((select public.can_view_location(user_id)));
grant select on public.current_locations to authenticated;
revoke insert, update, delete on public.current_locations from anon, authenticated;

create function public.request_connection(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid;
  normalized_phone text;
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  delete from public.invite_attempts
   where user_id = actor_id
     and attempted_at < now() - interval '1 day';

  if (select count(*) from public.invite_attempts
      where user_id = actor_id and attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Invitation limit reached. Try again later.';
  end if;

  insert into public.invite_attempts (user_id) values (actor_id);

  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return;
  end if;
  normalized_phone := p_phone;

  select u.id into target_id
    from auth.users u
   where u.phone = normalized_phone
     and u.phone_confirmed_at is not null
   limit 1;

  if target_id is null or target_id = actor_id then
    return;
  end if;

  insert into public.connections (requester_id, recipient_id, invited_by)
  values (actor_id, target_id, actor_id)
  on conflict (least(requester_id, recipient_id), greatest(requester_id, recipient_id)) do nothing;
end;
$$;

create function public.respond_to_connection(p_connection_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;

  if p_accept then
    update public.connections
       set status = 'accepted'
     where id = p_connection_id
       and recipient_id = actor_id
       and status = 'pending';
  else
    delete from public.connections
     where id = p_connection_id
       and recipient_id = actor_id
       and status = 'pending';
  end if;

  if not found then
    raise exception 'Invitation not found or no longer pending.';
  end if;
end;
$$;

create function public.remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;

  delete from public.connections
   where id = p_connection_id
     and status = 'accepted'
     and actor_id in (requester_id, recipient_id);

  if not found then
    raise exception 'Connection not found.';
  end if;
end;
$$;

create function public.start_sharing(p_duration_hours integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  expiry timestamptz;
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;
  if p_duration_hours not in (1, 4, 8) then
    raise exception 'Choose a supported sharing duration.';
  end if;

  expiry := now() + make_interval(hours => p_duration_hours);
  insert into public.sharing_sessions (user_id, expires_at, started_at)
  values (actor_id, expiry, now())
  on conflict (user_id) do update
    set expires_at = excluded.expires_at,
        started_at = excluded.started_at;
  return expiry;
end;
$$;

create function public.stop_sharing()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;

  delete from public.sharing_sessions where user_id = actor_id;
  delete from public.current_locations where user_id = actor_id;
  delete from public.location_retention where user_id = actor_id;
end;
$$;

create function public.publish_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in is required.';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 100000) then
    raise exception 'Invalid location coordinates.';
  end if;
  if not exists (
    select 1 from public.sharing_sessions s
     where s.user_id = actor_id and s.expires_at > now()
  ) then
    raise exception 'Start an active sharing session before publishing a location.';
  end if;

  insert into public.current_locations (user_id, latitude, longitude, accuracy_m, recorded_at)
  values (actor_id, p_latitude, p_longitude, p_accuracy_m, now())
  on conflict (user_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        recorded_at = excluded.recorded_at;

  insert into public.location_retention (user_id, delete_after)
  values (actor_id, now() + interval '24 hours')
  on conflict (user_id) do update set delete_after = excluded.delete_after;
end;
$$;

revoke all on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.can_view_location(uuid) from public, anon;
revoke all on function public.request_connection(text) from public, anon;
revoke all on function public.respond_to_connection(uuid, boolean) from public, anon;
revoke all on function public.remove_connection(uuid) from public, anon;
revoke all on function public.start_sharing(integer) from public, anon;
revoke all on function public.stop_sharing() from public, anon;
revoke all on function public.publish_location(double precision, double precision, double precision) from public, anon;

grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_location(uuid) to authenticated;
grant execute on function public.request_connection(text) to authenticated;
grant execute on function public.respond_to_connection(uuid, boolean) to authenticated;
grant execute on function public.remove_connection(uuid) to authenticated;
grant execute on function public.start_sharing(integer) to authenticated;
grant execute on function public.stop_sharing() to authenticated;
grant execute on function public.publish_location(double precision, double precision, double precision) to authenticated;

create function public.purge_expired_locations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.current_locations l
   using public.location_retention r
   where l.user_id = r.user_id
     and r.delete_after <= now();
  get diagnostics deleted_count = row_count;

  delete from public.location_retention where delete_after <= now();
  delete from public.sharing_sessions where expires_at <= now();
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_locations() from public, anon, authenticated;
