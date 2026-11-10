import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

export function AuthGate() {
  const {
    loading,
    configured,
    session,
    error: sessionError,
    clearError,
    requestCode,
    verifyCode,
  } = useAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.forest} />
        <Text style={styles.loadingText}>Connecting securely...</Text>
      </SafeAreaView>
    );
  }

  if (!configured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.configCard}>
          <Text style={styles.brand}>NEARSIDE</Text>
          <Text style={styles.title}>Connect your Supabase project</Text>
          <Text style={styles.copy}>
            Add your Supabase project URL and publishable key to a local .env file, apply the database migration, then restart Expo.
          </Text>
          <Text style={styles.code}>
            EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
            {'\n'}EXPO_PUBLIC_SUPABASE_KEY=your-publishable-key
          </Text>
          <Text style={styles.footnote}>
            Do not put a service-role key in the mobile app. The database migration is required to enforce consent and access controls.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session) return null;

  const submit = async () => {
    setError(null);
    setNotice(null);
    clearError();
    setSubmitting(true);

    try {
      const phone = phoneInput.replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        throw new Error('Enter your phone number in international format, for example +14155550123.');
      }

      if (codeSent) {
        const token = code.trim();
        if (!/^\d{6}$/.test(token)) throw new Error('Enter the 6-digit code from your SMS.');
        await verifyCode(phone, token);
      } else {
        await requestCode(phone);
        setCodeSent(true);
        setNotice('If SMS sign-in is enabled for your Supabase project, a verification code is on its way.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior="padding" style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><View style={styles.brandDot} /></View>
            <Text style={styles.brand}>NEARSIDE</Text>
            <Text style={styles.privateBadge}>PRIVATE BY DEFAULT</Text>
          </View>
          <Text style={styles.eyebrow}>CONSENT-FIRST LOCATION SHARING</Text>
          <Text style={styles.title}>Your circle, your choice.</Text>
          <Text style={styles.copy}>
            Sign in with your own verified phone number. No location is shared until you choose to start a session.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>YOUR PHONE NUMBER</Text>
            <TextInput
              accessibilityLabel="Your phone number"
              autoComplete="tel"
              editable={!submitting}
              keyboardType="phone-pad"
              onChangeText={setPhoneInput}
              placeholder="+1 415 555 0123"
              placeholderTextColor={colors.muted}
              style={styles.input}
              textContentType="telephoneNumber"
              value={phoneInput}
            />
            {codeSent && (
              <>
                <Text style={[styles.fieldLabel, styles.codeLabel]}>SMS VERIFICATION CODE</Text>
                <TextInput
                  accessibilityLabel="SMS verification code"
                  autoComplete="one-time-code"
                  editable={!submitting}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  textContentType="oneTimeCode"
                  value={code}
                />
              </>
            )}
            {(error || sessionError) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error ?? sessionError}
              </Text>
            )}
            {notice && <Text style={styles.notice}>{notice}</Text>}
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.pressed]}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Please wait...' : codeSent ? 'Verify and sign in' : 'Send verification code'}
              </Text>
              {!submitting && <Text style={styles.arrow}>→</Text>}
            </Pressable>
            {codeSent && (
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  setCodeSent(false);
                  setCode('');
                  setError(null);
                  setNotice(null);
                }}
                style={styles.changeNumber}
              >
                <Text style={styles.changeNumberText}>Change phone number</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.safetyNote}>
            Phone verification confirms your account. It cannot reveal or retrieve anyone else’s location.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboard: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 12,
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  brand: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  privateBadge: {
    color: colors.forest,
    backgroundColor: colors.limePale,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 21,
  },
  configCard: {
    margin: 22,
    padding: 22,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  formCard: {
    padding: 18,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeLabel: {
    marginTop: 15,
  },
  input: {
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.forest,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 17,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  arrow: {
    color: colors.lime,
    fontSize: 18,
    fontWeight: '700',
  },
  error: {
    color: '#A73D37',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  notice: {
    color: colors.forest,
    backgroundColor: colors.limePale,
    borderRadius: 12,
    padding: 10,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 11,
  },
  changeNumber: {
    alignItems: 'center',
    paddingTop: 15,
  },
  changeNumberText: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '700',
  },
  safetyNote: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
  footnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
  },
  code: {
    color: colors.forest,
    backgroundColor: colors.limePale,
    borderRadius: 12,
    padding: 12,
    fontSize: 10,
    lineHeight: 18,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.75,
  },
});
