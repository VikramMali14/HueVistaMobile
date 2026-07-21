import { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Canvas, Fill, Image, ImageShader, Shader, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { RECOLOR_OVERLAY_SKSL } from './overlayShader';
import { hexToRgb01 } from './color';
import { useAuthedSkImage } from './authedImage';

function compileOverlay() {
  const compiled = Skia.RuntimeEffect.Make(RECOLOR_OVERLAY_SKSL);
  if (!compiled) throw new Error('HueVista overlay shader failed to compile');
  return compiled;
}
const overlayEffect = compileOverlay();

/** One painted region: its (authed) mask URL and the applied shade colour. */
export interface PaintLayer {
  key: string;
  maskUrl: string;
  color: string;
  strength?: number;
}

export interface PaintedPhotoProps {
  photo: SkImage | null;
  layers: PaintLayer[];
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The editor canvas: the room photo with each region's applied shade composited
 * on top, luminance preserved. Each layer loads its own mask and paints only
 * that wall (transparent elsewhere), so all applied colours show at once.
 */
export function PaintedPhoto({ photo, layers, width, height, style }: PaintedPhotoProps) {
  if (!photo) return null;
  return (
    <View style={[{ width, height }, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Image image={photo} fit="cover" x={0} y={0} width={width} height={height} />
      </Canvas>
      {layers.map((layer) => (
        <RegionOverlay key={layer.key} photo={photo} layer={layer} width={width} height={height} />
      ))}
    </View>
  );
}

function RegionOverlay({ photo, layer, width, height }: { photo: SkImage; layer: PaintLayer; width: number; height: number }) {
  const mask = useAuthedSkImage(layer.maskUrl);
  const bounds = useMemo(() => rect(0, 0, width, height), [width, height]);
  const uniforms = useMemo(
    () => ({ targetColor: hexToRgb01(layer.color), strength: layer.strength ?? 1 }),
    [layer.color, layer.strength],
  );
  if (!mask) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill>
        <Shader source={overlayEffect} uniforms={uniforms}>
          <ImageShader image={photo} fit="cover" rect={bounds} tx="clamp" ty="clamp" />
          <ImageShader image={mask} fit="cover" rect={bounds} tx="clamp" ty="clamp" />
        </Shader>
      </Fill>
    </Canvas>
  );
}
