import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const tabs = [
  { label: 'Home', path: '/' },
  { label: 'People', path: '/people' },
  { label: 'Privacy', path: '/settings' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <Pressable
              key={tab.path}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(tab.path)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={[styles.indicator, active && styles.activeIndicator]} />
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  tab: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: 5,
    gap: 5,
  },
  indicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    backgroundColor: colors.forest,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  activeLabel: {
    color: colors.forest,
  },
  pressed: {
    opacity: 0.65,
  },
});
