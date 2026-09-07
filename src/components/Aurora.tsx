import { useEffect, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { Canvas, Circle, RadialGradient, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { colors, alpha, duration, easing, useAnimatedValue, useReducedMotion } from '../theme';

/**
 * The ambient ground every screen sits on: a warm vertical wash that lifts near
 * the top and falls to near-black, with two very faint brass blooms behind the
 * content.
 *
 * Why it exists: the app was a flat rectangle everywhere, so all depth had to
 * come from hairline borders and every screen looked like the same empty box.
 * The wash gives the layout somewhere to sit.
 *
 * ── Why it has almost no colour in it ─────────────────────────────────────
 * This used to be three saturated clouds — violet, deep violet and sage — and
 * the Studio and the shade page passed the CURRENT PAINT COLOUR in as a `tint`,
 * so the wall you were judging lit the whole screen behind it.
 *
 * That is backwards for a colour tool, and it is the single biggest reason a
 * shade looked one way in the app and another on the site. A wash of colour
 * behind a swatch is simultaneous contrast: the eye reads a colour relative to
 * its surround, so a violet ground pushes every warm shade toward green and
 * every neutral toward yellow — and tinting the ground with the shade ITSELF is
 * the worst case, because it desaturates the one colour the customer is trying
 * to decide about. Nobody reads that as a background problem. They read it as
 * the app showing the wrong paint.
 *
 * So the ground is struck from the charcoal and the brass only, both at
 * chromas low enough to sit under either half of the colour wheel without
 * arguing with it. There is no `tint` prop any more, on purpose.
 *
 * Rendering notes:
 *  - Blooms are radial gradients that fade to fully transparent, not blurred
 *    circles. Same look, no image filter, far cheaper to composite.
 *  - The drift is a native-driver transform on the wrapping view, so the Skia
 *    scene is painted once and never re-rendered per frame.
 *  - Skia on web needs a CanvasKit wasm bootstrap the app does not do, and this
 *    mounts on every screen, so web gets a layered-View approximation instead
 *    of taking the whole app down.
 */

export interface AuroraProps {
  /** 0 = off, 1 = default presence. Auth screens go brighter, lists calmer. */
  intensity?: number;
  /** Ambient drift. Off for screens where a still background reads better. */
  animated?: boolean;
}

/**
 * How much smaller than its displayed size the Skia scene is painted.
 * See the note in `SkiaAurora`.
 */
const AURORA_DOWNSCALE = 2;

/**
 * The two bloom positions, as fractions of the canvas box.
 *
 * Two, not three. The third sat at the bottom of every screen behind whatever
 * the content had ended with, and its only job was to make the decoration look
 * deliberate — which is the tell of a background designed for a screenshot
 * rather than for the thing in front of it.
 */
const BLOOMS = [
  { x: 0.18, y: 0.06, r: 0.82, weight: 0.55 },
  { x: 0.94, y: 0.34, r: 0.62, weight: 0.3 },
] as const;

/**
 * Peak opacity of a bloom at `intensity = 1`.
 *
 * Deliberately tiny. At the old 0.42 the brass would read as a gold haze in the
 * corner of every screen; at this weight it is the difference between a flat
 * black rectangle and a lit room, and you cannot name the colour doing it.
 */
const BLOOM_PEAK = 0.1;

export function Aurora({ intensity = 1, animated = true }: AuroraProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drift = useAnimatedValue(0);
  // A background that drifts forever is the first thing a person sensitive to
  // motion notices, and it is behind every screen in the app.
  const reduced = useReducedMotion();
  const moving = animated && !reduced;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  useEffect(() => {
    if (!moving) return;
    // One long loop up and back. Reversing rather than resetting keeps the
    // blooms from snapping back to their start position every cycle.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: duration.drift,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: duration.drift,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, drift]);

  const style = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -12] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        {Platform.OS === 'web' ? (
          <WebAurora intensity={intensity} />
        ) : size.width > 0 && size.height > 0 ? (
          <SkiaAurora width={size.width} height={size.height} intensity={intensity} />
        ) : null}
      </Animated.View>
    </View>
  );
}

function SkiaAurora({
  width,
  height,
  intensity,
}: {
  width: number;
  height: number;
  intensity: number;
}) {
  // The canvas is oversized so the drift transform never exposes an edge.
  const w = width * 1.3;
  const h = height * 1.3;
  const ox = -width * 0.15;
  const oy = -height * 0.15;

  /**
   * Painted at a fraction of its displayed size and scaled back up.
   *
   * A tab navigator keeps several screens mounted, and every one of them owns
   * an Aurora, so at full resolution this would hold a handful of screen-sized
   * Skia surfaces at once — tens of megabytes on a phone, for a background.
   * The scene is nothing but smooth gradients, which survive the resample with
   * no visible difference, so quartering the pixels is free.
   *
   * All the drawing below works in the reduced space: the bloom positions are
   * fractions of `cw`/`ch`, so they need no separate adjustment.
   */
  const cw = w / AURORA_DOWNSCALE;
  const ch = h / AURORA_DOWNSCALE;

  return (
    <Canvas
      style={{
        position: 'absolute',
        left: ox,
        top: oy,
        width: cw,
        height: ch,
        transform: [{ scale: AURORA_DOWNSCALE }],
        // Scale out from the corner the canvas is pinned to, so `left`/`top`
        // still place it; the default centre origin would shift it.
        transformOrigin: 'top left',
      }}
    >
      {/* Vertical wash — four steps of the same warm charcoal, not four hues. */}
      <Rect x={0} y={0} width={cw} height={ch}>
        <LinearGradient
          start={vec(cw * 0.5, 0)}
          end={vec(cw * 0.5, ch)}
          colors={[colors.auroraLift, colors.auroraMid, colors.bg, colors.bgDeep]}
          positions={[0, 0.3, 0.66, 1]}
        />
      </Rect>

      {BLOOMS.map((bloom, i) => {
        const c = vec(cw * bloom.x, ch * bloom.y);
        const r = Math.max(cw, ch) * bloom.r;
        const peak = BLOOM_PEAK * bloom.weight * intensity;
        return (
          <Circle key={i} c={c} r={r}>
            <RadialGradient
              c={c}
              r={r}
              colors={[
                alpha(colors.accent, peak),
                alpha(colors.accent, peak * 0.34),
                alpha(colors.accent, 0),
              ]}
              positions={[0, 0.45, 1]}
            />
          </Circle>
        );
      })}
    </Canvas>
  );
}

/**
 * Web stand-in. No radial gradients without extra deps, so this stacks a couple
 * of very low-opacity blocks to fake the bloom. It is not the real thing; it
 * just keeps `expo start --web` looking deliberate.
 */
function WebAurora({ intensity }: { intensity: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: alpha(colors.auroraMid, 0.9 * intensity), bottom: '45%' },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: '-30%',
          top: '-25%',
          width: '110%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: alpha(colors.accent, BLOOM_PEAK * 0.55 * intensity),
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: '-40%',
          top: '10%',
          width: '90%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: alpha(colors.accent, BLOOM_PEAK * 0.3 * intensity),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});
