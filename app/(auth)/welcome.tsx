import { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Serif, Button, PressableScale, Aurora } from '../../src/components';
import {
  colors,
  spacing,
  radius,
  fontSize,
  duration,
  easing,
  useAnimatedValue,
  useReducedMotion,
} from '../../src/theme';

/**
 * The wall, as a fan of paint.
 *
 * The obvious hero here is a photograph of a painted room, and the app has no
 * such photograph — the only bundled image is `sample-room.png`, a flat grey
 * segmentation fixture that under a gradient reads as an image that failed to
 * load. Shipping it as the first thing anyone sees would open the app on a
 * broken-looking rectangle.
 *
 * So the hero is the product itself: real catalogue colours at a size worth
 * judging, dealt out like chips fanned across a counter. It is honest — every
 * one of these is a shade the app can actually put on a wall — it needs no
 * photography, and it says "paint" in the first half second.
 *
 * Replace it with a real room photograph the moment there is one worth using;
 * `HERO` is the only thing to change.
 */
const HERO = [
  { hex: '#4d5b83', span: 2 },
  { hex: '#e9d6b0', span: 1 },
  { hex: '#9fb79a', span: 1 },
  { hex: '#c06a4d', span: 1 },
  { hex: '#2f6f6a', span: 2 },
  { hex: '#d8c3a5', span: 1 },
  { hex: '#7c5cff', span: 1 },
  { hex: '#c9cdc7', span: 2 },
  { hex: '#c98b86', span: 1 },
] as const;

/**
 * The first screen.
 *
 * This is one of the three places the italic serif is spent (see SERIF_BUDGET
 * in theme/typography.ts). It gets the word "chosen", which is the promise.
 *
 * Two ways in, in the order they are actually used: most people arrive holding
 * a slip of paper from a paint shop, so the code goes first and carries the lit
 * button. "Just looking" is real and stays, quietly.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Aurora intensity={1.15} />

      <View style={styles.hero}>
        <View style={styles.heroGrid}>
          {HERO.map((band, i) => (
            <Band key={band.hex} hex={band.hex} span={band.span} index={i} />
          ))}
        </View>
        {/* The colour runs out under the copy rather than stopping at an edge,
            so the type sits in the same space as the paint. */}
        <LinearGradient
          colors={['rgba(5,4,9,0)', 'rgba(5,4,9,0.72)', colors.bg]}
          locations={[0, 0.55, 0.94]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text variant="eyebrow" color={colors.accentSoft}>
            Asian Paints at launch
          </Text>
          <Text variant="display">
            See your walls in your <Serif size={fontSize.display}>chosen</Serif> colour — before you
            paint a single stroke.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="I have a code from my shop"
            size="lg"
            fullWidth
            onPress={() => router.push('/redeem-code')}
          />
          <Button
            label="Sign in"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/sign-in')}
          />
          <PressableScale
            onPress={() => router.push('/browse-shades')}
            haptic="tap"
            activeScale={0.96}
            accessibilityRole="button"
            style={styles.browse}
          >
            <Text variant="label" color={colors.fgMute}>
              Just looking? Browse the shade catalogue
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

/** One colour in the fan, arriving in turn. */
function Band({ hex, span, index }: { hex: string; span: number; index: number }) {
  const enter = useAnimatedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: reduced ? duration.fast : duration.reveal,
      delay: reduced ? 0 : index * 55,
      easing: easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [enter, index, reduced]);

  return (
    <Animated.View
      style={[
        styles.band,
        {
          flexGrow: span,
          backgroundColor: hex,
          opacity: enter,
          transform: [
            { scaleY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.86, 1] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '58%',
  },
  heroGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'stretch',
  },
  band: {
    // Three rows of bands, each at least a third of the width, so the fan reads
    // as a wall of colour rather than as a chart.
    flexBasis: '30%',
    height: '33.4%',
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  copy: { gap: spacing.md },
  actions: { gap: spacing.sm },
  browse: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
});
