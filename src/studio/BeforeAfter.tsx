import { useRef, useState } from 'react';
import { StyleSheet, View, ViewStyle, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SkImage } from '@shopify/react-native-skia';
import { Text } from '../components/Text';
import { colors, spacing, radius, alpha, elevation, hairline } from '../theme';
import { PaintedPhoto, type PaintLayer } from '../engine';
import { haptics } from '../haptics';

export interface BeforeAfterProps {
  photo: SkImage | null;
  layers: PaintLayer[];
  width: number;
  height: number;
  style?: ViewStyle;
}

/** How close to an edge the handle may be dragged, as a fraction of the width. */
const EDGE = 0.06;

/**
 * Drag a line across the room to wipe between the bare wall and the painted one.
 *
 * The whole product is an argument that this colour beats that wall, and the
 * app had no way to put the two side by side — you could hold the photo to peek
 * at the original, which shows you one or the other but never the join. The
 * join is where a person actually decides.
 *
 * Both sides are the same Skia composite drawn twice; the "before" copy is
 * clipped by a view whose width follows the finger. Nothing re-decodes as it
 * moves, so the wipe stays smooth while a five-wall room is composited.
 */
export function BeforeAfter({ photo, layers, width, height, style }: BeforeAfterProps) {
  const [split, setSplit] = useState(0.5);
  /**
   * The live split, for handlers that must not close over a stale render.
   * Only ever touched from a gesture callback — never read during render, where
   * `split` is the value.
   */
  const splitRef = useRef(0.5);

  const clamp = (n: number) => Math.max(EDGE, Math.min(1 - EDGE, n));

  const set = (next: number) => {
    const value = clamp(next);
    splitRef.current = value;
    setSplit(value);
  };

  /**
   * The raw responder props rather than a PanResponder.
   *
   * A PanResponder has to be built once and held in a ref, which means reading
   * `.current` during render to spread its handlers — the exact thing this
   * project's lint config forbids, and for a good reason. These four props do
   * the same job with no instance to keep, and `locationX` is already relative
   * to this view, so there is no page-offset arithmetic to get wrong either.
   */
  const onMove = (e: GestureResponderEvent) => set(e.nativeEvent.locationX / Math.max(1, width));

  const beforeWidth = Math.round(width * split);

  return (
    <View
      style={[styles.frame, { width, height }, style]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        haptics.tap();
        onMove(e);
      }}
      onResponderMove={onMove}
      accessibilityRole="adjustable"
      accessibilityLabel="Before and after"
      accessibilityHint="Swipe up or down to move the divider"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(split * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        set(splitRef.current + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))
      }
    >
      {/* After — the painted room, full width, underneath. */}
      <PaintedPhoto photo={photo} layers={layers} width={width} height={height} />

      {/* Before — the bare room, clipped to the left of the handle. */}
      <View style={[styles.clip, { width: beforeWidth }]} pointerEvents="none">
        <PaintedPhoto photo={photo} layers={[]} width={width} height={height} />
      </View>

      <View style={[styles.line, { left: beforeWidth }]} pointerEvents="none">
        <View style={styles.grip}>
          <Ionicons name="chevron-back" size={13} color={colors.fg} />
          <Ionicons name="chevron-forward" size={13} color={colors.fg} />
        </View>
      </View>

      <View style={[styles.tag, styles.tagLeft]} pointerEvents="none">
        <Text variant="eyebrow" color={colors.onPhoto}>
          Before
        </Text>
      </View>
      <View style={[styles.tag, styles.tagRight]} pointerEvents="none">
        <Text variant="eyebrow" color={colors.onPhoto}>
          After
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.rule,
    ...elevation.low,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: alpha(colors.onPhoto, 0.92),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.scrim,
    borderWidth: hairline,
    borderColor: alpha(colors.onPhoto, 0.42),
  },
  tag: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    borderWidth: hairline,
    borderColor: alpha(colors.onPhoto, 0.2),
  },
  tagLeft: { left: spacing.md },
  tagRight: { right: spacing.md },
});
