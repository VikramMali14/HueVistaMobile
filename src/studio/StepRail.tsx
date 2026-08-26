import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { colors, spacing, radius, alpha, fonts, fontSize, hairline } from '../theme';
import { STEPS, type StepId } from './roomStep';

export type { StepId };

export interface StepRailProps {
  current: StepId;
  /** Which step is waiting on the server right now — it gets the spinner. */
  busy?: StepId | null;
  style?: ViewStyle;
}

/**
 * Where you are in the room, in one line.
 *
 * The design this came from drew five labelled pills across a 390pt phone —
 * "1 Photo · 2 Tidy · 3 Walls · 4 Adjust · 5 Colour" — which needs about 340pt
 * of horizontal room before padding and did not have it, so the labels were set
 * at 9pt and still crowded the notch.
 *
 * This shows five dots and names only the step you are on. The dots carry
 * position (how far through, how much left) and the word carries meaning; that
 * is the same information in a third of the width, at a size a person can
 * actually read. A completed step gets a tick rather than its number, because
 * "done" is worth more than "which".
 */
export function StepRail({ current, busy, style }: StepRailProps) {
  const index = Math.max(
    0,
    STEPS.findIndex((s) => s.id === current),
  );
  const step = STEPS[index];

  return (
    <View
      style={[styles.rail, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${STEPS.length}: ${step.label}`}
      accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
    >
      <View style={styles.dots}>
        {STEPS.map((s, i) => {
          const done = i < index;
          const on = i === index;
          return (
            <View
              key={s.id}
              style={[
                styles.dot,
                on ? styles.dotOn : done ? styles.dotDone : null,
                // The current step's dot is a capsule, so position reads even
                // for someone who cannot separate the two greys.
                on ? { width: 18 } : null,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {step.label}
      </Text>
      {busy === step.id ? (
        <Ionicons name="ellipsis-horizontal" size={13} color={colors.accentSoft} />
      ) : (
        <Text style={styles.count}>
          {index + 1}/{STEPS.length}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    height: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha(colors.fg, 0.22),
  },
  dotDone: {
    backgroundColor: colors.accentDeep,
  },
  dotOn: {
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.fg,
  },
  count: {
    fontFamily: fonts.code,
    fontSize: fontSize.micro,
    color: colors.fgMute,
    fontVariant: ['tabular-nums'],
  },
});
