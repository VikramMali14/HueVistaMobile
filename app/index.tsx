import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { BrandMark } from '../src/components';
import { colors, spacing } from '../src/theme';

/**
 * Splash / gate. Shown at "/" while the session restores on launch; the root
 * auth gate then redirects to /welcome or the role home. Renders nothing that
 * depends on auth so it can appear instantly.
 */
export default function Index() {
  return (
    <View style={styles.root}>
      <BrandMark subtitle="Loading your workspace…" />
      <ActivityIndicator color={colors.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  spinner: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
});
