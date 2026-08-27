import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, alpha } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

/** Semantic status tones. Maps to the status color rules in PLAN.md §4. */
export type StatusTone = 'new' | 'progress' | 'done' | 'expired' | 'neutral';

/**
 * Pill text is 11px on a tinted ground, so every one of these is the cut of the
 * colour that survives as TEXT rather than as a rectangle: `accentSoft` over
 * `accent` (4.56:1 is too tight once the ground is tinted), `dangerSoft` over
 * the terracotta fill, and the sage's text cut.
 */
const toneColor: Record<StatusTone, string> = {
  new: colors.accentSoft,
  progress: colors.warning,
  done: colors.success,
  expired: colors.dangerSoft,
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
    <View style={[styles.pill, { backgroundColor: alpha(c, 0.13), borderColor: alpha(c, 0.34) }, style]}>
      <Text variant="code" color={c} style={styles.pillText}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small colour dot before the label — a shade family, a brand's swatch. */
  dot?: string | null;
  style?: ViewStyle;
}

/**
 * Fully-rounded selectable chip (brand/family/region filters). Selecting fires
 * a selection haptic, so scrubbing a filter row feels like a physical detent.
 */
export function Chip({ label, selected, onPress, dot, style }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={StyleSheet.flatten([
        styles.chip,
        selected
          ? { backgroundColor: colors.accentGhost, borderColor: colors.accent }
          : { backgroundColor: colors.glass, borderColor: colors.glassEdge },
        style,
      ])}
    >
      {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
      <Text variant="label" color={selected ? colors.accentSoft : colors.fgSoft}>
        {label}
      </Text>
    </PressableScale>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    // Filter rows are scrubbed with a thumb, so a chip is a full-height target
    // rather than however tall its label happens to make it.
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
});
