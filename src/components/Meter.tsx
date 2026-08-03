import { useEffect } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, alpha, duration, easing, useAnimatedValue } from '../theme';
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
 *
 * The fill animates to its value and carries a soft glow of its own colour, so
 * a quota crossing into the danger band is something you notice from across the
 * counter rather than something you have to read.
 *
 * `scaleX` rather than `width`: width cannot run on the native driver, and this
 * sits on the counter screen alongside image decoding.
 */
export function Meter({ value, max, label, showCount = true, style }: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const fill = ratio >= 0.9 ? colors.danger : ratio >= 0.7 ? colors.warning : colors.accent;

  const progress = useAnimatedValue(0);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: ratio,
      duration: duration.reveal,
      easing: easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [ratio, progress]);

  return (
    <View style={style}>
      {(label || showCount) && (
        <View style={styles.header}>
          {label ? <Text variant="overline">{label}</Text> : <View />}
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
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fill,
              shadowColor: fill,
              // `transformOrigin: left` (in styles.fill) anchors the scale to
              // the start of the track, so the bar grows from its origin rather
              // than expanding out from its middle.
              transform: [{ scaleX: progress }],
            },
          ]}
        />
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
    backgroundColor: alpha(colors.fg, 0.08),
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    transformOrigin: 'left',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
