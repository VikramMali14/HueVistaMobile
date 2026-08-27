import { useEffect } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Aurora, Text } from '../src/components';
import {
  colors,
  spacing,
  fontSize,
  duration,
  easing,
  useAnimatedValue,
  useReducedMotion,
} from '../src/theme';

const SPECTRUM = ['#7c5cff', '#a080ff', '#6fae76', '#d9b45c', '#cf7b60'];

/**
 * Launch.
 *
 * Shown at "/" for the moment the session is restored from the keystore; the
 * root gate then replaces it with /welcome or /home. Nothing here depends on
 * auth, so it paints instantly rather than showing a blank frame first.
 *
 * The design this came from ended the launch screen with "Tap to begin", which
 * is a canvas affordance rather than a product one: a real launch screen has
 * nothing to decide and nothing to wait for beyond a keystore read that takes
 * milliseconds. Asking for a tap would add a step to every single cold start.
 * The spectrum dealing itself out is the whole screen, and it is over before
 * anyone could have tapped.
 */
export default function Index() {
  return (
    <View style={styles.root}>
      <Aurora intensity={1.3} />
      <View style={styles.body}>
        <View style={styles.spectrum}>
          {SPECTRUM.map((c, i) => (
            <Bar key={c} color={c} index={i} />
          ))}
        </View>
        <Text variant="display" style={styles.wordmark}>
          HueVista
        </Text>
        <Text variant="eyebrow">Shades &amp; colours</Text>
      </View>
    </View>
  );
}

function Bar({ color, index }: { color: string; index: number }) {
  const enter = useAnimatedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: reduced ? duration.fast : duration.slow,
      delay: reduced ? 0 : 80 + index * 70,
      easing: easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [enter, index, reduced]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          shadowColor: color,
          opacity: enter,
          transform: [
            { scaleY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.3, 1] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  spectrum: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  bar: {
    width: 30,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  wordmark: {
    fontSize: fontSize.display + 4,
  },
});
