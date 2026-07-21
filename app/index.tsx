import { View, StyleSheet } from 'react-native';
import { Screen, Text, Card, Button, StatusPill } from '../src/components';
import { colors, spacing } from '../src/theme';
import { useSession } from '../src/auth';
import { API_ORIGIN } from '../src/api';

/**
 * Phase 0 landing. A branded smoke screen that proves the foundation runs:
 * fonts, theme, the UI kit, the session provider and the API config are all
 * wired. Phase 1 replaces this with the Welcome screen + role-based navigators.
 */
export default function Index() {
  const { status } = useSession();

  const statusTone = status === 'authenticated' ? 'done' : status === 'loading' ? 'progress' : 'neutral';

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.brand}>
        <View style={styles.spectrum}>
          {['#7c5cff', '#a080ff', '#7fae84', '#d9b45c', '#d0654c'].map((c) => (
            <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
        </View>
        <Text variant="display">HueVista</Text>
        <Text variant="bodySoft">Visualize paint shades on your walls, before you paint.</Text>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Text variant="heading">Foundation ready</Text>
          <StatusPill label="Phase 0" tone="done" />
        </View>
        <View style={styles.list}>
          {[
            'Midnight Spectrum theme + Space Grotesk',
            'UI kit — Button, Card, Pill, Input, Sheet, StatTile, Meter',
            'Typed API client with 401 auto-refresh',
            'Secure session store (Keychain / Keystore)',
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <View style={styles.dot} />
              <Text variant="bodySoft" style={styles.listText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text variant="label">Session</Text>
          <StatusPill label={status} tone={statusTone} />
        </View>
        <View style={styles.divider} />
        <Text variant="label">Backend</Text>
        <Text variant="mono" color={colors.fgSoft} style={styles.origin}>
          {API_ORIGIN}
        </Text>
      </Card>

      <Button label="Get started" onPress={() => {}} fullWidth size="lg" />
      <Text variant="caption" center>
        Sign-in and the visualizer land in Phase 1.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  brand: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  spectrum: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  swatch: {
    width: 34,
    height: 8,
    borderRadius: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  listText: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: spacing.md,
  },
  origin: {
    marginTop: spacing.xs,
  },
});
