import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { BrandMark, Aurora } from '../src/components';
import { colors, spacing } from '../src/theme';

/**
 * Splash / gate. Shown at "/" while the session restores on launch; the root
 * auth gate then redirects to /welcome or the role home. Renders nothing that
 * depends on auth so it can appear instantly.
 *
 * It shares the aurora with /welcome, so the hand-off between them is a change
 * of content rather than a change of scene.
 */
export default function Index() {
  return (
    <View style={styles.root}>
      <Aurora intensity={1.25} />
      <View style={styles.body}>
        <BrandMark subtitle="Loading your workspace…" />
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  spinner: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
});
