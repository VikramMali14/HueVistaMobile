import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, alpha } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

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

export interface DashedPillProps {
  label: string;
  onPress?: () => void;
  /** Leading glyph or swatch. */
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * A dashed-outline pill: an offer rather than a command.
 *
 * The reference uses these for "pick how you want to do this" menus, where a
 * column of solid buttons would shout four times over. Same job here — the
 * secondary routes into a flow (import an image, use a past room, enter a code
 * by hand) — while the one filled Button on the screen stays the primary path.
 */
export function DashedPill({ label, onPress, icon, disabled, style }: DashedPillProps) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      haptic="tap"
      activeScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={StyleSheet.flatten([styles.dashed, disabled ? { opacity: 0.45 } : null, style])}
    >
      {icon}
      <Text variant="label" color={colors.fg}>
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
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: alpha(colors.fg, 0.28),
    backgroundColor: alpha(colors.fg, 0.03),
    paddingHorizontal: spacing.lg,
  },
});
