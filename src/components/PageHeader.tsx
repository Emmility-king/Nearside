import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <View style={styles.brandDot} />
        </View>
        <Text style={styles.brand}>NEARSIDE</Text>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>CONSENT FIRST</Text>
        </View>
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 13,
    paddingBottom: 22,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 28,
  },
  brandMark: {
    width: 25,
    height: 25,
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
  demoBadge: {
    marginLeft: 'auto',
    borderRadius: 99,
    backgroundColor: colors.limePale,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  demoBadgeText: {
    color: colors.forest,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
});
