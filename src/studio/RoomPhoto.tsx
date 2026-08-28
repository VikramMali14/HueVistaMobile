import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SkImage } from '@shopify/react-native-skia';
import { Button, Text } from '../components';
import { colors, spacing, radius, alpha, elevation } from '../theme';
import { PaintedPhoto, type ImageLoadStatus, type PaintLayer } from '../engine';
import { tapToPhotoPoint, type TapPoint } from '../projects/tapPoint';

/** What the next tap on the photo will do. */
export type CanvasMode = 'idle' | 'mark' | 'pick';

export interface RoomPhotoProps {
  photo: SkImage | null;
  photoStatus: ImageLoadStatus;
  onReload: () => void;
  layers: PaintLayer[];
  /** The box the photo is drawn into — derived from the photo, see `fitBox`. */
  width: number;
  height: number;
  mode: CanvasMode;
  /** Called with normalized 0–1 photo coordinates when the canvas is armed. */
  onTap: (point: TapPoint) => void;
  /** Reported when a tap landed outside the photo, so the screen can say so. */
  onMiss?: () => void;
  /** Covers the canvas with a spinner and this line — detection, marking, saving. */
  busyLabel?: string | null;
  /** One line along the bottom edge, e.g. what a tap will do right now. */
  hint?: string | null;
}

/**
 * The room, at its own shape.
 *
 * This used to be a fixed 4:3 landscape box with the photo drawn `cover`, which
 * meant a phone-shaped photo — the normal case, since these are taken on the
 * phone that is displaying them — was cropped to its middle band. People were
 * painting a wall whose top they could not see. The box now comes from the
 * photo, so all of it is on screen and a tap maps straight through to it.
 */
export const RoomPhoto = forwardRef<View, RoomPhotoProps>(function RoomPhoto(
  { photo, photoStatus, onReload, layers, width, height, mode, onTap, onMiss, busyLabel, hint },
  shotRef,
) {
  const armed = mode !== 'idle' && !busyLabel;

  function handleTap(event: GestureResponderEvent) {
    if (!armed) return;
    const { locationX, locationY } = event.nativeEvent;
    const point = tapToPhotoPoint({
      locationX,
      locationY,
      boxWidth: width,
      boxHeight: height,
      photoWidth: photo?.width(),
      photoHeight: photo?.height(),
    });
    // A tap that lands on nothing must say so. Returning silently is
    // indistinguishable from the feature being broken.
    if (!point) {
      onMiss?.();
      return;
    }
    onTap(point);
  }

  return (
    <Pressable
      onPress={handleTap}
      // Deliberately NOT disabled when unarmed: a dead Pressable swallows the
      // tap, and the screen can explain instead.
      disabled={!armed}
      style={[
        styles.frame,
        { width, height },
        armed ? { borderColor: alpha(colors.accentSoft, 0.55) } : null,
      ]}
    >
      <View ref={shotRef} collapsable={false} style={StyleSheet.absoluteFill}>
        {photoStatus === 'error' ? (
          <View style={styles.centre}>
            <Text variant="body" color={colors.danger} center>
              Couldn&apos;t load this room&apos;s photo.
            </Text>
            <Button label="Try again" variant="secondary" onPress={onReload} />
          </View>
        ) : !photo ? (
          <View style={styles.centre}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <PaintedPhoto photo={photo} layers={layers} width={width} height={height} />
        )}
      </View>

      {busyLabel ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.onPhoto} />
          <Text variant="label" color={colors.onPhoto} style={styles.overlayLabel}>
            {busyLabel}
          </Text>
        </View>
      ) : hint ? (
        <View style={styles.hint} pointerEvents="none">
          {mode === 'pick' ? (
            <Ionicons name="eyedrop-outline" size={13} color={colors.onPhoto} />
          ) : mode === 'mark' ? (
            <Ionicons name="scan-outline" size={13} color={colors.onPhoto} />
          ) : null}
          <Text variant="caption" color={colors.onPhoto}>
            {hint}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
    ...elevation.low,
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  overlayLabel: { marginTop: spacing.sm },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.scrim,
  },
});
