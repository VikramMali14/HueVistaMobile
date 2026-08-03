import { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Canvas, Fill, Image, ImageShader, Shader, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { RECOLOR_OVERLAY_SKSL } from './overlayShader';
import { hexToRgb01 } from './color';
import { useAuthedSkImages } from './authedImage';

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
  /**
   * How the photo fills its box. `contain` shows all of it, which is what the
   * editor wants now that it sizes the box from the photo — `cover` cropped a
   * portrait room photo down to the middle band of the wall. Kept as an option
   * for thumbnails, where filling a fixed tile matters more than completeness.
   */
  fit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}

/**
 * The editor canvas: the room photo with each region's applied shade composited
 * on top, luminance preserved. Each layer paints only its own wall (transparent
 * elsewhere), so all applied colours show at once.
 *
 * Every wall is drawn into the SAME canvas. It used to get one canvas each,
 * stacked with absolute positioning — which reads as a tidy separation of
 * concerns and is, in graphics terms, close to the worst thing this screen could
 * do. A Skia canvas is a real GPU surface, so a five-wall room asked the driver
 * for six full-screen surfaces and re-bound the room photo as a texture in every
 * one of them. On a mid-range phone that is enough to exhaust graphics memory
 * and take the compositor — and sometimes the device — down with it.
 *
 * Stacked `Fill`s inside one canvas composite identically, because the overlay
 * shader already leaves everything outside its mask transparent. Same picture,
 * one surface, one upload of the photo.
 */
export function PaintedPhoto({ photo, layers, width, height, fit = 'contain', style }: PaintedPhotoProps) {
  // Hooks run before the null check so the order never changes between renders.
  const maskUrls = useMemo(() => layers.map((l) => l.maskUrl), [layers]);
  const masks = useAuthedSkImages(maskUrls);
  const bounds = useMemo(() => rect(0, 0, width, height), [width, height]);

  if (!photo) return null;
  return (
    <View style={[{ width, height }, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Image image={photo} fit={fit} x={0} y={0} width={width} height={height} />
        {layers.map((layer, i) => {
          const mask = masks[i];
          if (!mask) return null;
          return (
            <Fill key={layer.key}>
              {/* Both shaders take the SAME fit as the photo underneath: a mask
                  laid out differently from the picture it belongs to paints the
                  wrong pixels, which is subtler and worse than a visible
                  misalignment. */}
              <Shader
                source={overlayEffect}
                uniforms={{ targetColor: hexToRgb01(layer.color), strength: layer.strength ?? 1 }}
              >
                <ImageShader image={photo} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
                <ImageShader image={mask} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
              </Shader>
            </Fill>
          );
        })}
      </Canvas>
    </View>
  );
}
