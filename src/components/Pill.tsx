import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

/** Semantic status tones. Maps to the status color rules in PLAN.md §4. */
export type StatusTone = 'new' | 'progress' | 'done' | 'expired' | 'neutral';

const toneColor: Record<StatusTone, string> = {
  new: colors.accent,
  progress: colors.warning,
  done: colors.success,
  expired: colors.danger,
  neutral: colors.fgMute,
};

/**
 * Common backend status strings → tone. Extend as new statuses appear; unknown
 * values fall back to neutral.
 */
export function toneForStatus(status: string): StatusTone {
  const s = status.toUpperCase();
  if (['NEW'].includes(s)) return 'new';
  if (['IN PROGRESS', 'IN_PROGRESS', 'EXPIRING', 'PENDING'].includes(s)) return 'progress';
  if (['DONE', 'ACTIVE', 'PAID', 'COMPLETE', 'COMPLETED'].includes(s)) return 'done';
  if (['EXPIRED', 'OVERDUE', 'CANCELLED', 'DECLINED', 'FAILED'].includes(s)) return 'expired';
  return 'neutral';
}

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  style?: ViewStyle;
}

/** UPPERCASE mono status pill (8–10pt), tinted background + solid text. */
export function StatusPill({ label, tone = 'neutral', style }: StatusPillProps) {
  const c = toneColor[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c + '22', borderColor: c + '55' }, style]}>
      <Text variant="mono" color={c} style={styles.pillText}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Fully-rounded selectable chip (brand/family/region filters). */
export function Chip({ label, selected, onPress, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.accentGhost, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.rule },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Text variant="label" color={selected ? colors.accentSoft : colors.fgSoft}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 9,
    letterSpacing: 1,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
