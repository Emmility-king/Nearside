import { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      {children}
      <BottomNav />
    </SafeAreaView>
  );
}
