import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

export interface MeterProps {
  /** Current value, e.g. AI calls used this cycle. */
  value: number;
  /** Maximum, e.g. quota. */
  max: number;
  label?: string;
  /** Show "43 / 60" on the right. */
  showCount?: boolean;
  style?: ViewStyle;
}

/**
 * Horizontal progress meter — the retailer counter's AI quota indicator
 * (e.g. 43/60). Turns warning then danger as it fills.
 */
export function Meter({ value, max, label, showCount = true, style }: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const fill = ratio >= 0.9 ? colors.danger : ratio >= 0.7 ? colors.warning : colors.accent;

  return (
    <View style={style}>
      {(label || showCount) && (
        <View style={styles.header}>
          {label ? <Text variant="label">{label}</Text> : <View />}
          {showCount ? (
            <Text variant="mono" color={colors.fgSoft}>
              {value} / {max}
            </Text>
          ) : null}
        </View>
      )}
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: safeMax, now: value }}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
