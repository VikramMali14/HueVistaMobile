import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { Text } from './Text';

const SPECTRUM = ['#7c5cff', '#a080ff', '#7fae84', '#d9b45c', '#d0654c'];

/** The HueVista brand moment: spectrum bar + wordmark. Reused on auth screens. */
export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.spectrum}>
        {SPECTRUM.map((c) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
      </View>
      <Text variant="display">HueVista</Text>
      {subtitle ? <Text variant="bodySoft">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  spectrum: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  swatch: { width: 34, height: 8, borderRadius: 4 },
});
