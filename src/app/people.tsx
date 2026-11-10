import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  invited_by: string;
  status: 'pending' | 'accepted';
};

type Profile = {
  id: string;
  display_name: string;
};

type SharedLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  recorded_at: string;
};

export default function PeopleScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<SharedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!supabase || !userId) return;

    const { data: connectionRows, error: connectionError } = await supabase
      .from('connections')
      .select('id, requester_id, recipient_id, invited_by, status')
      .order('created_at', { ascending: false });
    if (connectionError) throw connectionError;

    const nextConnections = (connectionRows ?? []) as Connection[];
    const peerIds = [...new Set(nextConnections.map((connection) =>
      connection.requester_id === userId ? connection.recipient_id : connection.requester_id,
    ))];
    let nextProfiles: Profile[] = [];
    if (peerIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', peerIds);
      if (profileError) throw profileError;
      nextProfiles = (profileRows ?? []) as Profile[];
    }

    const acceptedIds = nextConnections
      .filter((connection) => connection.status === 'accepted')
      .map((connection) => connection.requester_id === userId
        ? connection.recipient_id
        : connection.requester_id);
    let nextLocations: SharedLocation[] = [];
    if (acceptedIds.length > 0) {
      const { data: locationRows, error: locationError } = await supabase
        .from('current_locations')
        .select('user_id, latitude, longitude, accuracy_m, recorded_at')
        .in('user_id', acceptedIds)
        .order('recorded_at', { ascending: false });
      if (locationError) throw locationError;
      nextLocations = (locationRows ?? []) as SharedLocation[];
    }

    setConnections(nextConnections);
    setProfiles(nextProfiles);
    setLocations(nextLocations);
    setError(null);
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        await loadConnections();
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your circle.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [loadConnections]);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.user_id, location])),
    [locations],
  );
  const incomingInvites = connections.filter(
    (connection) => connection.status === 'pending' && connection.invited_by !== userId,
  );
  const approvedConnections = connections.filter((connection) => connection.status === 'accepted');

  const closeInvite = () => {
    setPhoneNumber('');
    setInviteOpen(false);
  };

  const sendInvite = async () => {
    if (!supabase) {
      Alert.alert('Supabase is not configured', 'Add the Supabase project settings and restart the app.');
      return;
    }

    const phone = phoneNumber.trim().replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      Alert.alert('Check the number', 'Use international format, for example +14155550123.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: inviteError } = await supabase.rpc('request_connection', { p_phone: phone });
      if (inviteError) throw inviteError;
      await loadConnections();
      Alert.alert(
        'Invitation request processed',
        'If a Nearside account has this verified number, an invitation will appear in their app. We do not send SMS or disclose whether the number is registered.',
        [{ text: 'Done', onPress: closeInvite }],
      );
    } catch (inviteError) {
      Alert.alert(
        'Could not process invitation',
        inviteError instanceof Error ? inviteError.message : 'Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const respondToInvite = async (connectionId: string, accept: boolean) => {
    if (!supabase) return;
    try {
      const { error: responseError } = await supabase.rpc('respond_to_connection', {
        p_connection_id: connectionId,
        p_accept: accept,
      });
      if (responseError) throw responseError;
      await loadConnections();
    } catch (responseError) {
      Alert.alert(
        'Could not update invitation',
        responseError instanceof Error ? responseError.message : 'Check your connection and try again.',
      );
    }
  };

  const removeConnection = async (connectionId: string) => {
    if (!supabase) return;
    try {
      const { error: removeError } = await supabase.rpc('remove_connection', {
        p_connection_id: connectionId,
      });
      if (removeError) throw removeError;
      await loadConnections();
    } catch (removeError) {
      Alert.alert(
        'Could not remove connection',
        removeError instanceof Error ? removeError.message : 'Check your connection and try again.',
      );
    }
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="YOUR CIRCLE, YOUR CALL"
          title="People."
          subtitle="Location is visible only after an invitation is accepted."
        />

        <View style={styles.countCard}>
          <View>
            <Text style={styles.countLabel}>APPROVED PEOPLE</Text>
            <Text style={styles.count}>{approvedConnections.length}</Text>
          </View>
          <View style={styles.countSymbol}>
            <View style={styles.countDot} />
            <View style={[styles.countDot, styles.countDotOffset]} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setInviteOpen(true)}
          style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
        >
          <Text style={styles.inviteButtonText}>Invite by verified phone number</Text>
          <Text style={styles.inviteArrow}>+</Text>
        </Pressable>

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

        {incomingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invitations for you</Text>
            {incomingInvites.map((connection) => {
              const profile = profileById.get(connection.invited_by);
              return (
                <View key={connection.id} style={styles.personCard}>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{profile?.display_name ?? 'Nearside member'}</Text>
                    <Text style={styles.personStatus}>They want to add you to their circle</Text>
                    <Text style={styles.personStatus}>Accept only if you recognize this person.</Text>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void respondToInvite(connection.id, true)}
                      style={styles.acceptButton}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void respondToInvite(connection.id, false)}
                      style={styles.declineButton}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {approvedConnections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your circle</Text>
            {approvedConnections.map((connection) => {
              const peerId = connection.requester_id === userId
                ? connection.recipient_id
                : connection.requester_id;
              const profile = profileById.get(peerId);
              const sharedLocation = locationById.get(peerId);
              const updatedAt = sharedLocation
                ? new Date(sharedLocation.recorded_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null;

              return (
                <View key={connection.id} style={styles.personCard}>
                  <View style={styles.personHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(profile?.display_name ?? 'N').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{profile?.display_name ?? 'Nearside member'}</Text>
                      <Text style={styles.personStatus}>
                        {sharedLocation ? `Sharing · updated ${updatedAt}` : 'Not currently sharing'}
                      </Text>
                    </View>
                    <View style={[styles.personDot, sharedLocation && styles.personDotActive]} />
                  </View>
                  {sharedLocation && (
                    <View style={styles.locationPanel}>
                      <Text style={styles.coordinates}>
                        {sharedLocation.latitude.toFixed(5)}°, {sharedLocation.longitude.toFixed(5)}°
                      </Text>
                      <Text style={styles.accuracy}>
                        {sharedLocation.accuracy_m === null
                          ? 'Accuracy unavailable'
                          : `Approx. ±${Math.round(sharedLocation.accuracy_m)} m`}
                      </Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Alert.alert(
                      'Remove this connection?',
                      'They will no longer see your location, and you will no longer see theirs.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => void removeConnection(connection.id) },
                      ],
                    )}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeText}>Remove connection</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {!loading && connections.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyMark}><View style={styles.emptyMarkDot} /></View>
            <Text style={styles.emptyTitle}>Your circle starts with consent.</Text>
            <Text style={styles.emptyCopy}>
              People must have an account and accept your invitation before either of you can see a shared location.
            </Text>
          </View>
        )}

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>No number lookups</Text>
          <Text style={styles.safetyCopy}>
            Invitations go only to verified accounts, and the recipient must accept. A phone number cannot reveal anyone’s location.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeInvite}
        transparent
        visible={inviteOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalScrim}>
            <View style={styles.modalCard}>
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalHandle} />
                <Text style={styles.modalEyebrow}>INVITE BY VERIFIED PHONE</Text>
                <Text style={styles.modalTitle}>An invite needs two yeses.</Text>
                <Text style={styles.modalCopy}>
                  Enter the other person’s verified phone number. They must already have an account and accept in the app. We do not send SMS.
                </Text>
                <TextInput
                  accessibilityLabel="Phone number to invite"
                  autoComplete="tel"
                  editable={!submitting}
                  keyboardType="phone-pad"
                  onChangeText={setPhoneNumber}
                  placeholder="+1 415 555 0123"
                  placeholderTextColor={colors.muted}
                  style={styles.phoneInput}
                  textContentType="telephoneNumber"
                  value={phoneNumber}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => void sendInvite()}
                  style={({ pressed }) => [styles.inviteButton, (pressed || submitting) && styles.pressed]}
                >
                  <Text style={styles.inviteButtonText}>
                    {submitting ? 'Sending invitation...' : 'Send in-app invitation'}
                  </Text>
                  <Text style={styles.inviteArrow}>→</Text>
                </Pressable>
                <Pressable onPress={closeInvite} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  countCard: {
    backgroundColor: colors.limePale,
    borderRadius: radius.card,
    paddingHorizontal: 21,
    paddingVertical: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  countLabel: {
    color: colors.forest,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  count: {
    color: colors.forest,
    fontSize: 36,
    fontWeight: '700',
    marginTop: 5,
  },
  countSymbol: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#DFEFB8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDot: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.forest,
    left: 10,
    top: 13,
  },
  countDotOffset: {
    backgroundColor: colors.orange,
    left: 23,
    top: 20,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.forest,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inviteArrow: {
    color: colors.lime,
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  personCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.control,
    padding: 15,
    marginBottom: 9,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: colors.limePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: {
    color: colors.forest,
    fontSize: 15,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  personStatus: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  personDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8CEC8',
    marginLeft: 9,
  },
  personDotActive: {
    backgroundColor: '#76A85B',
  },
  locationPanel: {
    backgroundColor: colors.limePale,
    borderRadius: 12,
    padding: 12,
    marginTop: 13,
  },
  coordinates: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  accuracy: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingTop: 13,
  },
  removeText: {
    color: '#9B5542',
    fontSize: 11,
    fontWeight: '700',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: colors.quiet,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  declineText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 20,
    marginTop: 17,
    marginBottom: 14,
  },
  emptyMark: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: colors.quiet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  emptyMarkDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.orange,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  safetyCard: {
    borderRadius: radius.control,
    backgroundColor: colors.orangePale,
    padding: 16,
    marginTop: 14,
  },
  safetyTitle: {
    color: '#7E492F',
    fontSize: 12,
    fontWeight: '800',
  },
  safetyCopy: {
    color: '#865D49',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  error: {
    color: '#A73D37',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 35, 29, 0.45)',
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
    paddingBottom: 32,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7CEC5',
    marginBottom: 22,
  },
  modalEyebrow: {
    color: colors.orange,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
    marginTop: 8,
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 17,
  },
  phoneInput: {
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
