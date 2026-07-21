/**
 * Luminance-preserving recolor shader (SkSL runtime effect).
 *
 * For every pixel covered by the region mask, we replace the wall's hue/chroma
 * with the target shade while keeping that pixel's ORIGINAL luminance — so
 * shadows, highlights and surface texture survive and the paint reads as real.
 * This mirrors the website's WebGL engine (PLAN.md §6).
 *
 *   recolored = targetColor * (luma(pixel) / luma(targetColor))
 *   out       = mix(pixel, recolored, maskCoverage * strength)
 *
 * Children (declared order matters — RecolorCanvas passes them in this order):
 *   image — the room photo
 *   mask  — grayscale coverage in the red channel (white = wall, black = keep)
 */
export const RECOLOR_SKSL = `
uniform shader image;
uniform shader mask;
uniform half3 targetColor;
uniform half strength;

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  half coverage = mask.eval(xy).r;

  half3 W = half3(0.2126, 0.7152, 0.0722);
  half lum = dot(src.rgb, W);
  half targetLum = max(dot(targetColor, W), 0.0001);

  half3 recolored = clamp(targetColor * (lum / targetLum), 0.0, 1.0);
  half3 outColor = mix(src.rgb, recolored, coverage * strength);
  return half4(outColor, src.a);
}
`;
