import { useEffect, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Fill,
  Image,
  Shader,
  ImageShader,
  Skia,
  rect,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { RECOLOR_SKSL } from './recolorShader';
import { paintTarget } from './color';
import { blurredCopy, regionMeanLumaCached } from './formLayer';
import { DEFAULT_GRAIN, EDGE_AA, SHADOW_STRENGTH } from './renderSettings';

// Compile once at module load. On device this runs after Skia initializes; it is
// never evaluated during Metro bundling.
function compileEffect(): SkRuntimeEffect {
  const compiled = Skia.RuntimeEffect.Make(RECOLOR_SKSL);
  if (!compiled) throw new Error('HueVista recolor shader failed to compile');
  return compiled;
}
const effect = compileEffect();

export interface RecolorCanvasProps {
  photo: SkImage | null;
  /** Grayscale coverage mask (red channel = wall). Null → photo shown untinted. */
  mask: SkImage | null;
  /** Target shade as a hex string, e.g. "#e8d5b0". */
  color: string;
  /** The shade's measured LRV, when the catalogue has one — see `paintTarget`. */
  lrv?: number | null;
  /** 0..1 blend amount (the before/after wipe drives this). Default 1. */
  strength?: number;
  /** Whole-image midtone lift (the Brighten control); 1 = untouched. */
  bright?: number;
  width: number;
  height: number;
  /** How the photo fills the box. `contain` shows all of it — see PaintedPhoto. */
  fit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}

/**
 * One surface, painted — the before/after wipe and the thumbnails.
 *
 * Same shader and same constants as the multi-surface editor canvas, so the
 * colour a customer compares against the "before" is the colour they were just
 * looking at. Runs entirely on the GPU, so dragging the wipe or switching shades
 * is instant and free.
 */
export function RecolorCanvas({
  photo,
  mask,
  color,
  lrv,
  strength = 1,
  bright = 1,
  width,
  height,
  fit = 'contain',
  style,
}: RecolorCanvasProps) {
  const bounds = useMemo(() => rect(0, 0, width, height), [width, height]);

  // The form layer the shader splits the photo's light on. One offscreen surface
  // per photo, disposed when the photo changes — see PaintedPhoto for why
  // holding two full-size Skia images at once is the thing to avoid.
  const form = useMemo(() => (photo ? blurredCopy(photo) : null), [photo]);
  useEffect(
    () => () => {
      // blurredCopy hands back the original when the device refuses a surface;
      // disposing that would take the photo out from under the canvas.
      if (form && form !== photo) {
        (form as unknown as { dispose?: () => void }).dispose?.();
      }
    },
    [form, photo],
  );

  // The region's mean luminance in the photo — what the paint is normalised
  // against. Both inputs are stable for the life of a room, so this is measured
  // once and survives every shade change.
  const baseL = useMemo(
    () => (photo && mask ? regionMeanLumaCached(photo, mask) : 0),
    [photo, mask],
  );

  const uniforms = useMemo(
    () => ({
      targetColor: paintTarget(color, lrv),
      strength,
      preserve: SHADOW_STRENGTH,
      baseL,
      grain: DEFAULT_GRAIN,
      bright,
      edgeAA: EDGE_AA,
    }),
    [color, lrv, strength, baseL, bright],
  );

  if (!photo) return null;

  // Without a mask there is nothing to recolor — show the untinted photo.
  if (!mask) {
    return (
      <Canvas style={[{ width, height }, style]}>
        <Image image={photo} fit={fit} x={0} y={0} width={width} height={height} />
      </Canvas>
    );
  }

  return (
    <Canvas style={[{ width, height }, style]}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={photo} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
          <ImageShader image={form ?? photo} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
          <ImageShader image={mask} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
        </Shader>
      </Fill>
    </Canvas>
  );
}
