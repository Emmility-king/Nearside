import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthGate } from '../components/AuthGate';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SharingProvider } from '../context/SharingContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigation />
    </AuthProvider>
  );
}

function AppNavigation() {
  const { configured, loading, session } = useAuth();

  if (!configured || loading || !session) return <AuthGate />;

  return (
    <SharingProvider key={session.user.id}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      />
    </SharingProvider>
  );
}
