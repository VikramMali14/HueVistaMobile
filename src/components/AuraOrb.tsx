import { useEffect, useMemo } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { colors, alpha, fonts, fontSize, easing, useAnimatedValue } from '../theme';
import { Text } from './Text';

/**
 * A glowing disc with a progress ring around it — the app's one hero figure.
 *
 * It replaces the places where an important number was set in the same 30pt
 * type as everything else and therefore did not read as important at all:
 * projects remaining on Home, the shop's AI quota on the counter, a shade's
 * colour on the detail sheet.
 *
 * The glow takes `color`, so on a shade screen the orb *is* the paint — the
 * number sits inside the actual colour under discussion rather than beside a
 * swatch of it.
 */

export interface AuraOrbProps {
  /** 0–1. Drives the ring; omit for a plain glowing disc with no ring. */
  progress?: number;
  /** Glow colour. Defaults to the brand accent. */
  color?: string;
  /** Diameter (dp). */
  size?: number;
  /** Big centred figure. */
  value?: string | number;
  /** Small line above the value. */
  label?: string;
  /** Small line below the value. */
  caption?: string;
  /** Replaces the value/label/caption stack entirely. */
  children?: React.ReactNode;
  /** Slow scale-and-glow pulse. */
  animated?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const RING_WIDTH = 3;

export function AuraOrb({
  progress,
  color = colors.accent,
  size = 210,
  value,
  label,
  caption,
  children,
  animated = true,
  style,
  accessibilityLabel,
}: AuraOrbProps) {
  const breathe = useAnimatedValue(0);

  const clamped = progress == null ? null : Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 3200,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 3200,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View
      style={[{ width: size, height: size }, styles.root, style]}
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ??
        [label, value != null ? String(value) : null, caption].filter(Boolean).join(' ')
      }
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }], opacity: glowOpacity }]}>
        {Platform.OS === 'web' ? (
          <WebOrb size={size} color={color} />
        ) : (
          <OrbCanvas size={size} color={color} />
        )}
      </Animated.View>

      {clamped != null ? <ProgressRing size={size} color={color} value={clamped} /> : null}

      <View style={styles.center} pointerEvents="none">
        {children ?? (
          <>
            {label ? (
              <Text variant="label" center color={alpha(colors.fg, 0.72)} style={styles.label}>
                {label}
              </Text>
            ) : null}
            {value != null ? (
              <Text style={[styles.value, { fontSize: size * 0.28 }]} center>
                {value}
              </Text>
            ) : null}
            {caption ? (
              <Text variant="caption" center color={alpha(colors.fg, 0.5)}>
                {caption}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

/** The glowing body: a bright core falling off to transparent, over a soft halo. */
function OrbCanvas({ size, color }: { size: number; color: string }) {
  const c = vec(size / 2, size / 2);
  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Halo — wider than the orb, very faint, sells the light spill. */}
      <Circle c={c} r={size / 2}>
        <RadialGradient
          c={c}
          r={size / 2}
          colors={[alpha(color, 0.34), alpha(color, 0.14), alpha(color, 0)]}
          positions={[0, 0.62, 1]}
        />
      </Circle>
      {/* Body. */}
      <Circle c={c} r={size * 0.4}>
        <RadialGradient
          c={vec(size / 2, size * 0.42)}
          r={size * 0.42}
          colors={[alpha(color, 0.5), alpha(color, 0.2), alpha(color, 0.06)]}
          positions={[0, 0.58, 1]}
        />
      </Circle>
    </Canvas>
  );
}

function WebOrb({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alpha(color, 0.18),
        borderWidth: 1,
        borderColor: alpha(color, 0.28),
      }}
    />
  );
}

/**
 * The track, the filled arc, and a bead at the arc's head.
 *
 * The arc is drawn at its value rather than sweeping to it: Skia's path trim
 * (`start`/`end`) is a render-time prop, so animating it would cost a React
 * render per frame, which is not a trade worth making for a progress ring that
 * already arrives inside a `Reveal`. It redraws when the value changes.
 */
function ProgressRing({ size, color, value }: { size: number; color: string; value: number }) {
  if (Platform.OS === 'web') return <WebRing size={size} color={color} />;
  return <SkiaRing size={size} color={color} value={value} />;
}

/**
 * Split from `ProgressRing` rather than guarded inside it. Hooks run before any
 * conditional return, so building the path in this component's body executed
 * `Skia.Path.Make()` on web too — where Skia is a CanvasKit shim this app never
 * bootstraps, so it is undefined and the whole screen threw. The platform check
 * has to happen before the hook, which means before this component mounts.
 */
function WebRing({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: RING_WIDTH,
        borderColor: alpha(color, 0.28),
      }}
    />
  );
}

function SkiaRing({ size, color, value }: { size: number; color: string; value: number }) {
  const r = size / 2 - RING_WIDTH;
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(size / 2, size / 2, r);
    return p;
  }, [size, r]);

  // Head-of-arc dot, placed with trig. addCircle starts at 3 o'clock, and the
  // group below rotates -90° so the ring starts at 12 o'clock like the eye
  // expects; the dot is computed in the same rotated space.
  const angle = value * Math.PI * 2 - Math.PI / 2;
  const dot = vec(size / 2 + r * Math.cos(angle), size / 2 + r * Math.sin(angle));

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: size, height: size }]} pointerEvents="none">
      {/* Track. */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={RING_WIDTH}
        color={alpha(colors.fg, 0.1)}
      />
      {/* Filled arc, rotated to start at the top. */}
      <Group origin={vec(size / 2, size / 2)} transform={[{ rotate: -Math.PI / 2 }]}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={RING_WIDTH}
          strokeCap="round"
          color={color}
          start={0}
          end={value}
        />
      </Group>
      {/* Head dot — the small bright bead the reference puts at the arc's tip. */}
      {value > 0.02 && value < 0.995 ? (
        <Circle c={dot} r={RING_WIDTH * 1.6} color={colors.fg} />
      ) : null}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { maxWidth: '68%' },
  value: { fontFamily: fonts.displayBold, color: colors.fg, letterSpacing: -1, lineHeight: undefined },
});

/** Re-exported so screens can size a value's type against the default orb. */
export const ORB_VALUE_SIZE = fontSize.display;
