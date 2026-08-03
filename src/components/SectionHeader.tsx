import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

export interface SectionHeaderProps {
  title: string;
  /** Right-hand affordance, e.g. "See all". Omit for a plain marker. */
  actionLabel?: string;
  onAction?: () => void;
  /** Trailing element instead of an action — a count, a status pill. */
  trailing?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * The "Recent projects  ·  See all" row.
 *
 * Home, Projects, the counter and both dashboards each rebuilt this inline with
 * slightly different spacing and a bare `Pressable` for the action, so section
 * titles drifted apart across the app and none of the "See all" taps gave any
 * feedback. One component, one rhythm.
 */
export function SectionHeader({ title, actionLabel, onAction, trailing, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text variant="overline">{title}</Text>
      {trailing ??
        (actionLabel && onAction ? (
          <PressableScale onPress={onAction} haptic="tap" activeScale={0.94} style={styles.action}>
            <Text variant="label" color={colors.accentSoft}>
              {actionLabel}
            </Text>
          </PressableScale>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  action: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
  },
});
