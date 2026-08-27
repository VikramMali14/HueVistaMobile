import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, hairline, alpha, duration, easing, useAnimatedValue, useReducedMotion } from '../theme';
import { Text } from './Text';
import { Button } from './Button';

export interface WorkCardProps {
  title: string;
  /** How long this usually takes, in words. Never a countdown we cannot honour. */
  subtitle?: string;
  /** Seconds since the work started — the app counts, the server does not report. */
  elapsedSeconds?: number;
  /**
   * A typical duration in seconds, used to pace the bar.
   *
   * The bar is deliberately NOT a percentage: the backend reports QUEUED and
   * then READY with nothing in between, so any number here would be invented.
   * It eases toward 90% over the expected time and waits there — honest about
   * being an estimate, and it never sits at 100% while nothing has arrived.
   */
  expectedSeconds?: number;
  /** Shown under the bar. "Keep the app open", "Credit charged at the end". */
  note?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  style?: ViewStyle;
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/**
 * The app is waiting on the server and wants to keep the user.
 *
 * Every long step routes through this — clean-up, wall detection, an AI image —
 * so waiting looks the same wherever it happens, and every one of them has a
 * way out. A spinner with no cancel is how a customer ends up force-quitting.
 */
export function WorkCard({
  title,
  subtitle,
  elapsedSeconds = 0,
  expectedSeconds = 30,
  note,
  onCancel,
  cancelLabel = 'Stop and go back',
  style,
}: WorkCardProps) {
  const reduced = useReducedMotion();
  const progress = useAnimatedValue(0);
  const [width, setWidth] = useState(0);

  const target = Math.min(0.9, expectedSeconds > 0 ? elapsedSeconds / expectedSeconds : 0);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: target,
      duration: reduced ? 0 : duration.slow,
      easing: easing.standard,
      // Driving translateX rather than width keeps this on the UI thread.
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [target, progress, reduced]);

  return (
    <View style={[styles.card, style]} accessibilityRole="progressbar" accessibilityLabel={title}>
      <View style={styles.head}>
        <View style={styles.text}>
          <Text variant="heading">{title}</Text>
          {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
        </View>
        {elapsedSeconds > 0 ? (
          <Text variant="code" color={colors.fgSoft}>
            {mmss(elapsedSeconds)}
          </Text>
        ) : null}
      </View>

      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Animated.View
            style={[
              styles.fill,
              {
                width,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
      </View>

      {note ? <Text variant="caption">{note}</Text> : null}

      {onCancel ? <Button label={cancelLabel} variant="secondary" fullWidth onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glassStrong,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.fg, 0.1),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
