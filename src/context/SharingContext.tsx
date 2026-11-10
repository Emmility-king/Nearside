import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { ShareDuration } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type LocationReading = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: Date;
};

type SharingContextValue = {
  location: LocationReading | null;
  sessionEndsAt: Date | null;
  sharingActive: boolean;
  sharingError: string | null;
  startSharing: (location: LocationReading, duration: ShareDuration) => Promise<void>;
  stopSharing: () => Promise<void>;
};

const SharingContext = createContext<SharingContextValue | null>(null);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The location update could not be sent.';
}

export function SharingProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [location, setLocation] = useState<LocationReading | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = useState<Date | null>(null);
  const [sharingActive, setSharingActive] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>('active');
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const publishLocation = useCallback(async (reading: LocationReading) => {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.rpc('publish_location', {
      p_latitude: reading.latitude,
      p_longitude: reading.longitude,
      p_accuracy_m: reading.accuracy,
    });
    if (error) throw error;

    setLocation(reading);
    setSharingError(null);
  }, []);

  const stopSharing = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setSharingActive(false);
    setSessionEndsAt(null);
    setLocation(null);

    if (!supabase || !userId) return;
    const { error } = await supabase.rpc('stop_sharing');
    if (error) {
      setSharingError(`Sharing stopped on this device, but the server could not confirm revocation: ${error.message}`);
      throw error;
    }

    setSharingError(null);
  }, [userId]);

  const startSharing = useCallback(
    async (reading: LocationReading, duration: ShareDuration) => {
      if (!supabase || !userId) throw new Error('Sign in before starting location sharing.');

      setSharingError(null);
      const { data, error } = await supabase.rpc('start_sharing', {
        p_duration_hours: duration,
      });
      if (error) throw error;
      if (typeof data !== 'string') throw new Error('The server did not return a sharing expiry time.');

      const expiry = new Date(data);
      if (Number.isNaN(expiry.getTime())) throw new Error('The server returned an invalid sharing expiry time.');
      setSessionEndsAt(expiry);
      setSharingActive(true);

      try {
        await publishLocation(reading);
      } catch (publishError) {
        let revokeError: unknown = null;
        try {
          const { error: stopError } = await supabase.rpc('stop_sharing');
          revokeError = stopError;
        } finally {
          setSharingActive(false);
          setSessionEndsAt(null);
        }
        if (revokeError) {
          throw new Error(
            `The location could not be published (${getErrorMessage(publishError)}), and the server could not revoke the session (${getErrorMessage(revokeError)}).`,
          );
        }
        throw publishError;
      }
    },
    [publishLocation, userId],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
      if (nextAppState !== 'active' && sharingActive) {
        void stopSharing().catch((error: unknown) => {
          setSharingError(`Sharing ended when the app left the foreground: ${getErrorMessage(error)}`);
        });
      }
    });
    return () => subscription.remove();
  }, [sharingActive, stopSharing]);

  useEffect(() => {
    if (!userId || !supabase) return;

    let active = true;
    void Promise.resolve(supabase
      .from('sharing_sessions')
      .select('expires_at')
      .eq('user_id', userId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSharingError(`Could not check the sharing session: ${error.message}`);
          return;
        }
        if (data?.expires_at) {
          const expiry = new Date(data.expires_at);
          if (expiry.getTime() > Date.now()) {
            setSessionEndsAt(expiry);
            setSharingActive(true);
          }
        }
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setSharingError(`Could not check the sharing session: ${getErrorMessage(sessionError)}`);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!sharingActive || !sessionEndsAt) return;

    const timer = setInterval(() => {
      if (sessionEndsAt.getTime() <= Date.now()) {
        watchRef.current?.remove();
        watchRef.current = null;
        setSharingActive(false);
        setSessionEndsAt(null);
        setLocation(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionEndsAt, sharingActive]);

  useEffect(() => {
    if (!sharingActive || appState !== 'active') {
      watchRef.current?.remove();
      watchRef.current = null;
      return;
    }

    let cancelled = false;
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 25,
      },
      (position) => {
        const reading: LocationReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp),
        };
        void publishLocation(reading).catch((error: unknown) => {
          setSharingError(`Location update failed: ${getErrorMessage(error)}`);
        });
      },
    )
      .then((subscription) => {
        if (cancelled) {
          subscription.remove();
          return;
        }
        watchRef.current?.remove();
        watchRef.current = subscription;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSharingError(`Location updates could not start: ${getErrorMessage(error)}`);
        }
      });

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [appState, publishLocation, sharingActive]);

  const value = useMemo<SharingContextValue>(
    () => ({
      location,
      sessionEndsAt,
      sharingActive,
      sharingError,
      startSharing,
      stopSharing,
    }),
    [location, sessionEndsAt, sharingActive, sharingError, startSharing, stopSharing],
  );

  return <SharingContext.Provider value={value}>{children}</SharingContext.Provider>;
}

export function useSharing() {
  const context = useContext(SharingContext);
  if (!context) throw new Error('useSharing must be used inside SharingProvider.');
  return context;
}
