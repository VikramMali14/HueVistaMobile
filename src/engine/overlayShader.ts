/**
 * Region-overlay variant of the recolor shader. Unlike the base shader (which
 * returns the opaque photo outside the mask), this outputs the recolored wall
 * with alpha = coverage and TRANSPARENT elsewhere — premultiplied — so several
 * region overlays can be stacked over one base photo, each painting only its own
 * wall. This is how the editor shows every applied colour at once.
 */
export const RECOLOR_OVERLAY_SKSL = `
uniform shader image;
uniform shader mask;
uniform half3 targetColor;
uniform half strength;

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  half coverage = mask.eval(xy).r;
  half a = coverage * strength;

  half3 W = half3(0.2126, 0.7152, 0.0722);
  half lum = dot(src.rgb, W);
  half targetLum = max(dot(targetColor, W), 0.0001);
  half3 recolored = clamp(targetColor * (lum / targetLum), 0.0, 1.0);

  // Premultiplied so it composites over the base photo with src-over blending.
  return half4(recolored * a, a);
}
`;
