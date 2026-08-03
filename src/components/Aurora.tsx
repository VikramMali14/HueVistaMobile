import { useEffect, useMemo, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { Canvas, Circle, RadialGradient, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { colors, alpha, duration, easing, useAnimatedValue } from '../theme';

/**
 * The ambient background every screen sits on: a vertical wash that blooms
 * violet at the top and falls to near-black, with three soft colour clouds
 * drifting behind the content.
 *
 * Why this exists: the app was a flat #0a090f rectangle everywhere, so all
 * depth had to come from hairline borders, and every screen looked like the
 * same empty box. The wash gives the layout somewhere to sit.
 *
 * `tint` shifts the clouds toward a specific colour. The Studio passes the
 * shade currently on the wall, so the room you are painting quietly lights the
 * whole screen — the one place the background knows what the app is doing.
 *
 * Rendering notes:
 *  - Clouds are radial gradients that fade to fully transparent, not blurred
 *    circles. Same look, no image filter, far cheaper to composite.
 *  - The drift is a native-driver transform on the wrapping view, so the Skia
 *    scene is painted once and never re-rendered per frame.
 *  - Skia on web needs a CanvasKit wasm bootstrap the app does not do, and this
 *    mounts on every screen, so web gets a layered-View approximation instead
 *    of taking the whole app down.
 */

export interface AuroraProps {
  /** Hex to bias the clouds toward. Defaults to the brand accent. */
  tint?: string | null;
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

/** The three cloud positions, as fractions of the canvas box. */
const CLOUDS = [
  { x: 0.16, y: 0.1, r: 0.78, weight: 0.5 },
  { x: 0.96, y: 0.3, r: 0.66, weight: 0.34 },
  { x: 0.44, y: 0.72, r: 0.9, weight: 0.16 },
] as const;

export function Aurora({ tint, intensity = 1, animated = true }: AuroraProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drift = useAnimatedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  useEffect(() => {
    if (!animated) return;
    // One long loop up and back. Reversing rather than resetting keeps the
    // clouds from snapping back to their start position every cycle.
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
  }, [animated, drift]);

  const base = tint || colors.accent;

  const style = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [10, -18] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        {Platform.OS === 'web' ? (
          <WebAurora tint={base} intensity={intensity} />
        ) : size.width > 0 && size.height > 0 ? (
          <SkiaAurora width={size.width} height={size.height} tint={base} intensity={intensity} />
        ) : null}
      </Animated.View>
    </View>
  );
}

function SkiaAurora({
  width,
  height,
  tint,
  intensity,
}: {
  width: number;
  height: number;
  tint: string;
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
   * All the drawing below works in the reduced space: the cloud positions are
   * fractions of `cw`/`ch`, so they need no separate adjustment.
   */
  const cw = w / AURORA_DOWNSCALE;
  const ch = h / AURORA_DOWNSCALE;

  // Each cloud gets the tint at its own strength, plus a brand colour alongside
  // it so a tinted screen still reads as HueVista rather than as one flat hue.
  const cloudColors = useMemo(
    () => [tint, colors.accentDeep, colors.success],
    [tint],
  );

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
      {/* Vertical wash. */}
      <Rect x={0} y={0} width={cw} height={ch}>
        <LinearGradient
          start={vec(cw * 0.5, 0)}
          end={vec(cw * 0.5, ch)}
          colors={[colors.auroraMid, colors.auroraDeep, colors.bg, colors.bgDeep]}
          positions={[0, 0.34, 0.68, 1]}
        />
      </Rect>

      {CLOUDS.map((cloud, i) => {
        const c = vec(cw * cloud.x, ch * cloud.y);
        const r = Math.max(cw, ch) * cloud.r;
        const peak = Math.min(0.42, cloud.weight * 0.62 * intensity);
        return (
          <Circle key={i} c={c} r={r}>
            <RadialGradient
              c={c}
              r={r}
              colors={[
                alpha(cloudColors[i], peak),
                alpha(cloudColors[i], peak * 0.34),
                alpha(cloudColors[i], 0),
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
 * Web stand-in. No radial gradients without extra deps, so this stacks a few
 * very low-opacity rounded blocks to fake the bloom. It is not the real thing;
 * it just keeps `expo start --web` looking deliberate.
 */
function WebAurora({ tint, intensity }: { tint: string; intensity: number }) {
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
          backgroundColor: alpha(tint, 0.16 * intensity),
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
          backgroundColor: alpha(colors.accentDeep, 0.12 * intensity),
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
