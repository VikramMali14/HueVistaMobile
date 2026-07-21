import { useMemo } from 'react';
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
import { hexToRgb01 } from './color';

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
  /** Target shade as a hex string, e.g. "#7c5cff". */
  color: string;
  /** 0..1 blend amount (before/after slider drives this). Default 1. */
  strength?: number;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders `photo` with the masked region recolored to `color`, luminance
 * preserved. Runs entirely on the GPU, so dragging the strength slider or
 * switching shades is instant and free (PLAN.md §2.7).
 */
export function RecolorCanvas({ photo, mask, color, strength = 1, width, height, style }: RecolorCanvasProps) {
  const bounds = useMemo(() => rect(0, 0, width, height), [width, height]);
  const uniforms = useMemo(
    () => ({ targetColor: hexToRgb01(color), strength }),
    [color, strength],
  );

  if (!photo) return null;

  // Without a mask there is nothing to recolor — show the untinted photo.
  if (!mask) {
    return (
      <Canvas style={[{ width, height }, style]}>
        <Image image={photo} fit="cover" x={0} y={0} width={width} height={height} />
      </Canvas>
    );
  }

  return (
    <Canvas style={[{ width, height }, style]}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={photo} fit="cover" rect={bounds} tx="clamp" ty="clamp" />
          <ImageShader image={mask} fit="cover" rect={bounds} tx="clamp" ty="clamp" />
        </Shader>
      </Fill>
    </Canvas>
  );
}
