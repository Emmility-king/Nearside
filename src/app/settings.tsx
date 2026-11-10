import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useSharing } from '../context/SharingContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { sharingActive, stopSharing } = useSharing();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!supabase || !session?.user.id) {
        setLoadingProfile(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!active) return;
      if (profileError) {
        setError(profileError.message);
      } else {
        setDisplayName(data?.display_name ?? '');
      }
      setLoadingProfile(false);
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const saveProfile = async () => {
    if (!supabase || !session?.user.id) return;
    const name = displayName.trim();
    if (name.length < 1 || name.length > 40) {
      setError('Choose a display name between 1 and 40 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .update({ display_name: name })
        .eq('id', session.user.id);
      if (saveError) throw saveError;
      Alert.alert('Profile updated', 'Your display name has been saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSaving(true);
    setError(null);
    try {
      if (sharingActive) await stopSharing();
      await signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out safely.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="YOUR DATA, YOUR RULES"
          title="Privacy."
          subtitle="Sharing is opt-in, time-limited, and visible to you."
        />

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}><View style={styles.privacyIconCenter} /></View>
          <Text style={styles.privacyTitle}>Private by design</Text>
          <Text style={styles.privacyCopy}>
            Only accepted connections can view a recent location. Stop sharing at any time; stale locations become unavailable and are deleted by the configured cleanup job.
          </Text>
          <View style={styles.divider} />
          {[
            'Location permission is requested only when you start sharing',
            'Sharing is limited to the foreground and up to 8 hours',
            'Location access requires an accepted connection',
            'Old locations are purged by the configured cleanup job',
          ].map((item) => (
            <View key={item} style={styles.checkRow}>
              <Text style={styles.checkMark}>✓</Text>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Your profile</Text>
        </View>
        <View style={styles.profileCard}>
          <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
          <TextInput
            accessibilityLabel="Display name"
            editable={!loadingProfile && !saving}
            maxLength={40}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={displayName}
          />
          <Pressable
            accessibilityRole="button"
            disabled={loadingProfile || saving}
            onPress={() => void saveProfile()}
            style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}
          >
            <Text style={styles.saveText}>{saving ? 'Please wait...' : 'Save name'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>VERIFIED PHONE</Text>
          <Text style={styles.accountValue}>{session?.user.phone ?? 'Not available'}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.signOutButton, (pressed || saving) && styles.pressed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

        <Text style={styles.version}>NEARSIDE · CONSENT-FIRST LOCATION SHARING</Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  privacyCard: {
    backgroundColor: colors.forest,
    borderRadius: radius.card,
    padding: 20,
  },
  privacyIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: '#315B4D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  privacyIconCenter: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.lime,
  },
  privacyTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  privacyCopy: {
    color: '#C6D5CD',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#49675B',
    marginVertical: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkMark: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '800',
    width: 22,
  },
  checkText: {
    flex: 1,
    color: '#E4ECE6',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionLabel: {
    marginTop: 25,
    marginBottom: 11,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 16,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginTop: 12,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 16,
  },
  accountLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  accountValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 5,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: 15,
    paddingVertical: 5,
  },
  signOutText: {
    color: '#9B5542',
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: '#A73D37',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  version: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 22,
  },
  pressed: {
    opacity: 0.75,
  },
});
