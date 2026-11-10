# Nearside

Nearside is an Expo mobile app for **opt-in location sharing between people who accept each other’s invitations**. A phone number is used to find an existing verified account; it cannot be used to look up someone’s location. The app does not send invitation SMS.

## Set up Supabase

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and the publishable key (or legacy anon key). Never use a service-role key in the app.
3. Copy `.env.example` to `.env` and enter those two values as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
4. Open Supabase **SQL Editor** and run [`supabase/migrations/20261110000000_consent_based_location_sharing.sql`](./supabase/migrations/20261110000000_consent_based_location_sharing.sql).
5. In **Authentication → Providers**, enable Phone and configure an SMS provider. Set appropriate rate limits and CAPTCHA/abuse controls before production.
6. Enable the Supabase `pg_cron` extension and schedule location cleanup:

   ```sql
   select cron.schedule(
     'purge-expired-locations',
     '*/15 * * * *',
     'select public.purge_expired_locations();'
   );
   ```

7. Restart Expo so it reads the environment:

   ```sh
   npm install
   npx expo start -c
   ```

The migration uses RLS and narrowly scoped database functions. Review it and test with separate accounts before launch. The app must use only the publishable/anon key; database access must never rely on a client-held service-role secret.
Never add `SUPABASE_SECRET_KEY`, a service-role key, or any other secret to an Expo app or an `EXPO_PUBLIC_*` variable. If a secret key has been shared or committed, revoke and rotate it in Supabase immediately. `SUPABASE_JWKS_URL` is not needed by this client app.

`DATABASE_URL` and `DIRECT_URL` in `.env.example` are optional, server/database-tool-only connection string templates; this Expo app and its SQL Editor setup do not use them. Replace `[YOUR-PASSWORD]` only in a local ignored `.env` or secure server secret store, URL-encode special characters in the password, and never expose either variable to client code or prefix it with `EXPO_PUBLIC_`.

## Sharing behavior

- Users sign in by verifying their own phone number with an SMS code.
- Invitations are accepted or declined in the app. A pending invite does not grant location access.
- The recipient must already have a verified Nearside account. The inviter gets a generic response that does not confirm whether a number is registered; pending invite details are visible only to the recipient.
- Users can start a 1-, 4-, or 8-hour session. The app requests foreground location permission only when sharing starts.
- Location updates are sent to Supabase while the app is in the foreground. Background location is not enabled; leaving the foreground ends the sharing session.
- Only accepted connections can read a recent location. Locations become unavailable to viewers after two minutes without an update and are purged after 24 hours when the scheduled cleanup job is enabled.
- Users can stop sharing or remove a connection at any time. If a stop request cannot reach the server, the app reports that failure; the two-minute stale-location limit provides an additional bound.

## Development

```sh
npm install
npm run lint
npx tsc --noEmit
npx expo start
```

Web location access requires a secure browser context and browser permission. Native location access uses Expo’s foreground permission prompt.
