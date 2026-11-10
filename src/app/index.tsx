import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { LocationReading, useSharing } from '../context/SharingContext';
import { ShareDuration } from '../types';
import { colors, radius } from '../theme';

const durations: ShareDuration[] = [1, 4, 8];

export default function HomeScreen() {
  const {
    location,
    sessionEndsAt,
    sharingActive,
    sharingError,
    startSharing,
    stopSharing,
  } = useSharing();
  const [selectedDuration, setSelectedDuration] = useState<ShareDuration>(1);
  const [loading, setLoading] = useState(false);

  const startLocationSharing = async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location permission needed',
          'Allow location access while using the app to share your live location with people who have accepted your invitation.',
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const reading: LocationReading = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
        capturedAt: new Date(current.timestamp),
      };
      await startSharing(reading, selectedDuration);
    } catch (error) {
      Alert.alert(
        'Could not start sharing',
        error instanceof Error ? error.message : 'Please check your device location settings and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStopSharing = async () => {
    setLoading(true);
    try {
      await stopSharing();
    } catch (error) {
      Alert.alert(
        'Could not confirm sharing was stopped',
        error instanceof Error ? error.message : 'Check your internet connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const locationTime = location?.capturedAt.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="A LITTLE CLOSER, BY CHOICE"
          title="Stay in the loop."
          subtitle="Location sharing should always feel like your choice."
        />

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, sharingActive && styles.statusDotActive]} />
              <Text style={styles.statusPillText}>{sharingActive ? 'SHARING WITH YOUR CIRCLE' : 'PRIVATE BY DEFAULT'}</Text>
            </View>
            <Text style={styles.lockMark}>FOREGROUND ONLY</Text>
          </View>
          <Text style={styles.statusTitle}>
            {sharingActive ? 'Your location is sharing.' : 'Your location is yours.'}
          </Text>
          <Text style={styles.statusCopy}>
            {sharingActive
              ? 'Only people who accepted your invitation can see your recent location. Sharing ends when the timer runs out or you stop it.'
              : 'Your location is private until you start a sharing session. Only accepted connections can view it.'}
          </Text>

          {sharingActive ? (
            <View style={styles.activeActions}>
              <Text style={styles.expiryText}>
                Ends at {sessionEndsAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleStopSharing}
                style={({ pressed }) => [styles.stopButton, (pressed || loading) && styles.pressed]}
              >
                <Text style={styles.stopButtonText}>{loading ? 'Stopping...' : 'Stop sharing'}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.durationLabel}>SHARING DURATION</Text>
              <View style={styles.durationRow}>
                {durations.map((duration) => (
                  <Pressable
                    key={duration}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedDuration === duration }}
                    onPress={() => setSelectedDuration(duration)}
                    style={[
                      styles.durationOption,
                      selectedDuration === duration && styles.durationOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        selectedDuration === duration && styles.durationTextSelected,
                      ]}
                    >
                      {duration} {duration === 1 ? 'hour' : 'hours'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={startLocationSharing}
                style={({ pressed }) => [
                  styles.startButton,
                  (pressed || loading) && styles.pressed,
                ]}
              >
                <Text style={styles.startButtonText}>
                  {loading ? 'Starting secure session...' : 'Start sharing'}
                </Text>
                {!loading && <Text style={styles.buttonArrow}>→</Text>}
              </Pressable>
            </>
          )}
          {sharingError && (
            <Text accessibilityRole="alert" style={styles.sharingError}>{sharingError}</Text>
          )}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your shared location</Text>
          <Text style={styles.sectionHint}>VISIBLE TO YOUR CIRCLE</Text>
        </View>
        <View style={styles.locationCard}>
          <View style={styles.mapPreview}>
            <View style={styles.liveMark}>
              <View style={styles.liveDot} />
            </View>
            <Text style={styles.mapTitle}>{sharingActive ? 'Sharing is on' : 'Sharing is off'}</Text>
            <Text style={styles.mapDescription}>Only accepted connections can view your recent location.</Text>
          </View>
          <View style={styles.locationDetails}>
            <View style={styles.locationTitleRow}>
              <View>
                <Text style={styles.locationTitle}>
                  {location ? 'Last location update' : 'No location shared'}
                </Text>
                <Text style={styles.locationSubtitle}>
                  {locationTime ? `Updated at ${locationTime}` : 'Start sharing to send your location'}
                </Text>
              </View>
              <View style={styles.locationBadge}>
                <Text style={styles.locationBadgeText}>{sharingActive ? 'LIVE SESSION' : 'PRIVATE'}</Text>
              </View>
            </View>
            {location && (
              <Text style={styles.coordinates}>
                {location.latitude.toFixed(4)}°  {location.longitude.toFixed(4)}°
                {location.accuracy !== null ? `  ·  ±${Math.round(location.accuracy)}m` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeMark}>
            <Text style={styles.noticeMarkText}>i</Text>
          </View>
          <Text style={styles.noticeText}>
            Location updates go to Supabase only during a session you start. Background tracking is off; stale locations stop being visible and are automatically deleted.
          </Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  statusCard: {
    borderRadius: radius.card,
    backgroundColor: colors.forest,
    padding: 21,
    marginBottom: 27,
  },
  statusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.forestLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lime,
    marginRight: 7,
  },
  statusDotActive: {
    backgroundColor: '#BDEB65',
  },
  statusPillText: {
    color: '#E8F0E7',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  lockMark: {
    color: '#BED0C6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 21,
  },
  statusCopy: {
    color: '#C6D5CD',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 22,
  },
  sharingError: {
    color: '#FFD4C8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 13,
  },
  durationLabel: {
    color: '#ADC4B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 9,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  durationOption: {
    borderRadius: radius.pill,
    borderColor: '#527165',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  durationOptionSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  durationText: {
    color: '#E2ECE6',
    fontSize: 11,
    fontWeight: '600',
  },
  durationTextSelected: {
    color: colors.forest,
    fontWeight: '800',
  },
  startButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  startButtonText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonArrow: {
    color: colors.forest,
    fontSize: 18,
    fontWeight: '700',
  },
  activeActions: {
    borderTopColor: '#456457',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiryText: {
    color: '#E2ECE6',
    fontSize: 12,
    fontWeight: '600',
  },
  stopButton: {
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  stopButtonText: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  locationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderColor: colors.line,
    borderWidth: 1,
  },
  mapPreview: {
    minHeight: 112,
    backgroundColor: '#EAF0E5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  liveMark: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#D8F276',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.forest,
  },
  mapTitle: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  mapDescription: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 4,
  },
  locationDetails: {
    padding: 15,
  },
  locationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  locationSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  locationBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.quiet,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  locationBadgeText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coordinates: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.limePale,
    borderRadius: radius.control,
    padding: 14,
    marginTop: 15,
  },
  noticeMark: {
    height: 17,
    width: 17,
    borderRadius: 9,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    marginTop: 1,
  },
  noticeMarkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  noticeText: {
    flex: 1,
    color: colors.forest,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.75,
  },
});
