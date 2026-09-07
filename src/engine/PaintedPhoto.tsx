import { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  Canvas,
  Fill,
  Image,
  ImageShader,
  Shader,
  Skia,
  rect,
  type SkImage,
} from '@shopify/react-native-skia';
import { BRIGHTEN_SKSL, RECOLOR_OVERLAY_SKSL } from './recolorShader';
import { paintTarget } from './color';
import { blurredCopy, regionMeanLumaCached } from './formLayer';
import { DEFAULT_GRAIN, EDGE_AA, SHADOW_STRENGTH } from './renderSettings';
import { useAuthedSkImages } from './authedImage';

function compile(source: string, what: string) {
  const compiled = Skia.RuntimeEffect.Make(source);
  if (!compiled) throw new Error(`HueVista ${what} shader failed to compile`);
  return compiled;
}
const overlayEffect = compile(RECOLOR_OVERLAY_SKSL, 'overlay');
const brightenEffect = compile(BRIGHTEN_SKSL, 'brighten');

/** One painted region: its (authed) mask URL and the applied shade. */
export interface PaintLayer {
  key: string;
  maskUrl: string;
  color: string;
  /**
   * The shade's Light Reflectance Value, when the catalogue measured one.
   *
   * This is what makes the wall the colour the can is. Undefined means there is
   * no measurement to trust — a colour lifted out of the photo, or picked off a
   * wheel — and the raw hex is then painted unchanged, which is what the website
   * does with the same colour.
   */
  lrv?: number | null;
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
  /**
   * Whole-image midtone lift (the Brighten control), 1 = the photo untouched.
   * Applied to the base photo AND to every painted surface, so the paint sits in
   * the same light rather than floating dark on a lifted photo.
   */
  bright?: number;
  style?: StyleProp<ViewStyle>;
}

/** Skia images hold native memory GC will not reclaim promptly. */
function dispose(image: SkImage | null) {
  (image as unknown as { dispose?: () => void } | null)?.dispose?.();
}

/**
 * A blurred copy of the photo, rebuilt only when the photo changes.
 *
 * The blur is the form layer the shader splits the photo's light on (see
 * formLayer.ts). It costs one offscreen surface at photo resolution, which is
 * why it is memoised on the image identity and disposed the moment a new photo
 * replaces it: holding two full-size Skia images is exactly the peak the decode
 * downscaler exists to avoid.
 */
function useFormLayer(photo: SkImage | null): SkImage | null {
  const form = useMemo(() => (photo ? blurredCopy(photo) : null), [photo]);

  useEffect(
    () => () => {
      // `blurredCopy` hands back the original when the device refuses a
      // surface; disposing that would take the photo out from under the canvas.
      if (form && form !== photo) dispose(form);
    },
    [form, photo],
  );

  return form;
}

/**
 * Each mask's mean luminance in the photo — the shader's `baseL`, one per layer.
 *
 * Measured rather than assumed, because it is what the paint is normalised
 * against: get it wrong and the wall averages to the wrong colour. The
 * measurement is cached on the image pair, so re-picking a shade (which changes
 * nothing about the geometry) never re-reads a pixel.
 */
function useRegionBaseLuma(photo: SkImage | null, masks: (SkImage | null)[]): number[] {
  return useMemo(
    () => masks.map((mask) => (photo && mask ? regionMeanLumaCached(photo, mask) : 0)),
    [photo, masks],
  );
}

/**
 * The editor canvas: the room photo with each region's applied shade composited
 * on top, sitting in the photo's own light.
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
export function PaintedPhoto({
  photo,
  layers,
  width,
  height,
  fit = 'contain',
  bright = 1,
  style,
}: PaintedPhotoProps) {
  // Hooks run before the null check so the order never changes between renders.
  const maskUrls = useMemo(() => layers.map((l) => l.maskUrl), [layers]);
  const masks = useAuthedSkImages(maskUrls);
  const form = useFormLayer(photo);
  const baseLuma = useRegionBaseLuma(photo, masks);
  const bounds = useMemo(() => rect(0, 0, width, height), [width, height]);
  const lifted = bright > 1.001;

  if (!photo) return null;
  return (
    <View style={[{ width, height }, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {lifted ? (
          // The base photo goes through the same gamma the paint does, so the
          // two halves of the picture are lit alike.
          <Fill>
            <Shader source={brightenEffect} uniforms={{ bright }}>
              <ImageShader image={photo} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
            </Shader>
          </Fill>
        ) : (
          <Image image={photo} fit={fit} x={0} y={0} width={width} height={height} />
        )}
        {layers.map((layer, i) => {
          const mask = masks[i];
          if (!mask) return null;
          return (
            <Fill key={layer.key}>
              {/* Every shader child takes the SAME fit as the photo underneath:
                  a mask or a form layer laid out differently from the picture it
                  belongs to paints the wrong pixels, which is subtler and worse
                  than a visible misalignment. */}
              <Shader
                source={overlayEffect}
                uniforms={{
                  targetColor: paintTarget(layer.color, layer.lrv),
                  strength: layer.strength ?? 1,
                  preserve: SHADOW_STRENGTH,
                  baseL: baseLuma[i] ?? 0,
                  grain: DEFAULT_GRAIN,
                  bright,
                  edgeAA: EDGE_AA,
                }}
              >
                <ImageShader image={photo} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
                <ImageShader
                  image={form ?? photo}
                  fit={fit}
                  rect={bounds}
                  tx="clamp"
                  ty="clamp"
                />
                <ImageShader image={mask} fit={fit} rect={bounds} tx="clamp" ty="clamp" />
              </Shader>
            </Fill>
          );
        })}
      </Canvas>
    </View>
  );
}
