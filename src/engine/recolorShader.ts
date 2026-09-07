/**
 * The recolor shader, ported from the website's WebGL2 engine
 * (`HueVistaFrontEnd/src/lib/webgl-recolor.ts`) so a shade painted on the phone
 * is the same colour as the same shade painted on the site.
 *
 * ── What it used to be ────────────────────────────────────────────────────
 *
 *   recolored = targetColor * (luma(pixel) / luma(targetColor))
 *   out       = mix(pixel, recolored, coverage * strength)
 *
 * Two lines, and every one of the website's decisions missing from them. That
 * normalises by the SWATCH's luminance rather than by the wall's, so the painted
 * surface averages to whatever the room was lit at instead of to the colour on
 * the can — a bright room paints every shade too light, a dim one paints every
 * shade too dark, and neither matches the site. It carries no form/detail split,
 * so a wall's texture comes through only as a flat luminance multiply. And it
 * clamps at white, which drains the colour out of exactly the lit faces the eye
 * uses to decide what a surface is made of.
 *
 * ── What it is now ────────────────────────────────────────────────────────
 * The website's arithmetic, constant for constant:
 *
 *  · FORM — the swatch is tinted by the SMOOTH large-scale light, normalised by
 *    the region's own mean luminance (`baseL`) so the wall still averages to the
 *    true swatch colour.
 *  · DETAIL — everything the blur smoothed away (plaster stipple, seams,
 *    reveals, hard shadow edges) is applied as a RATIO L/B, not as an added
 *    delta. Adding a luminance difference pushes a colour toward grey in the
 *    highlights and toward black in the shadows; multiplying keeps the hue.
 *  · Shading below 1.0 is deepened by an extra gamma so the paint sits INTO the
 *    surface; above 1.0 it is sunlight, which should make the swatch BRIGHTER,
 *    so a lit face is rescaled by its peak channel instead of being clipped at
 *    white, and only a genuinely over-range highlight earns a little real white.
 *  · A hair of grain, because a perfectly flat fill reads as CGI.
 *
 * ── What is deliberately NOT ported ───────────────────────────────────────
 * The website's `u_anchor` / `u_anchorDiv` / `u_relief` paths. Those are opt-in
 * and, on the site, only `/admin/studio-test` opts in: the studio, the share view
 * and the render studio all leave them off. Porting the customer's path exactly
 * is the point; porting a bench's would make the phone differ from the site in a
 * new direction.
 *
 * Children (declared order matters — the canvases pass them in this order):
 *   image — the room photo
 *   blur  — a blurred copy of it (the form layer; see formLayer.ts)
 *   mask  — grayscale coverage in the red channel (white = wall, black = keep)
 */

/**
 * Everything above `main`, shared by the base and overlay variants below.
 *
 * The two differ only in what they do with the pixels outside the mask — the
 * base shader returns the photo, the overlay returns transparent — so the paint
 * itself is written once. Two copies of this arithmetic is two shaders that
 * drift, and the drift would show up as one wall painted differently from the
 * wall beside it.
 */
const RECOLOR_COMMON = `
uniform shader image;
uniform shader blur;
uniform shader mask;
uniform float3 targetColor;
uniform float strength;
// Shadow/relief preservation. 0 = flat exact fill (the swatch everywhere);
// 1 = fully follow the photo's light.
uniform float preserve;
// The region's mean luminance in the photo. 0 means it could not be measured,
// and the shader then lays down the flat swatch rather than a wrong colour.
uniform float baseL;
// Per-pixel noise amplitude: a floor of texture for perfectly smooth walls where
// the photo itself carries almost none. 0 disables it.
uniform float grain;
// Whole-image brighten: a gamma midtone lift, output = input^(1/bright).
// 1 = untouched. Applied to the base photo AND the paint alike, so the colour
// sits in the same brightened light instead of floating dark on a lifted photo.
// A gamma lift keeps pure white where it is, so bright skies don't clip.
uniform float bright;
// 1 = sharpen the mask edge to about one output pixel; 0 = use the mask's own
// alpha untouched.
uniform float edgeAA;

// --- How the paint is made to sit in the photo's light -----------------------
// Gain on the photo's shading below the form layer's scale, and the amplitude at
// which it rolls off. Both live in the LOG (ratio) domain, because shading is a
// ratio: DETAIL_KNEE is the largest number of e-folds the detail term may apply.
// The roll-off is a SOFT saturation, not a clip.
const float DETAIL_GAIN = 1.15;
const float DETAIL_KNEE = 1.0;
// How dark a form shadow may get, how bright a lit face may get, and the extra
// gamma applied below 1.0 so shadows deepen instead of sitting flat.
const float FORM_FLOOR = 0.22;
const float FORM_CEIL = 2.4;
const float SHADOW_DEPTH = 0.35;
// Mask edge: the alpha at which the surface starts, and how many output pixels
// the antialiased transition spans.
const float EDGE_T = 0.5;
const float EDGE_W = 0.9;
// How much true white a genuinely over-range highlight may take on. Small: this
// is specular sheen, not the main way a lit wall gets brighter.
const float HI_WHITE = 0.15;
// Multiplicative shading costs a little chroma; hand it back.
const float SAT = 1.06;

float luma(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

float3 brighten(float3 c) {
  if (bright <= 1.001) return c;
  return pow(max(c, 0.0), float3(1.0 / bright));
}

// Cheap hash -> pseudo-random 0..1 from a position, for grain.
float hash(float2 p) {
  p = fract(p * float2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

/**
 * The mask's coverage at xy, with its edge optionally sharpened to about one
 * output pixel.
 *
 * The website normalises the edge threshold by fwidth(m), the screen-space rate
 * of change of the mask. SkSL runtime effects have no derivative functions, so
 * the slope is estimated from two neighbouring taps instead — which is what
 * fwidth computes anyway, just per-quad rather than per-pixel. The taps are one
 * unit apart in the canvas's own coordinates, so the transition lands at about
 * one layout point rather than one device pixel; the point of it is the same
 * either way. Without it the transition is as wide as the mask's own resolution
 * makes it, and since masks arrive at a lower resolution than the photo that is
 * several points of mush, bleeding wall colour over window frames and railings.
 */
float coverageAt(float2 xy) {
  float m = float(mask.eval(xy).r);
  float dx = abs(float(mask.eval(xy + float2(1.0, 0.0)).r) - m);
  float dy = abs(float(mask.eval(xy + float2(0.0, 1.0)).r) - m);
  float w = max(dx + dy, 1e-5) * EDGE_W;
  float aa = smoothstep(EDGE_T - w, EDGE_T + w, m);
  return mix(m, aa, edgeAA);
}

/** The paint to lay down at xy, before grain and before the brighten lift. */
float3 paintAt(float2 xy, float3 src) {
  float3 paint = targetColor;
  if (preserve <= 0.001 || baseL <= 0.001) return paint;

  float L = luma(src);
  float3 Brgb = float3(blur.eval(xy).rgb);  // large-scale (form) light
  float B = luma(Brgb);

  // FORM: normalise by the region's own mean luminance so the wall still
  // averages to the true swatch colour (the colour on the can).
  float3 form = float3(B / baseL);
  form = clamp(form, FORM_FLOOR, FORM_CEIL);
  form = mix(float3(1.0), form, preserve);

  // Shading is MULTIPLICATIVE, split at 1.0 so each half is treated on its own
  // terms. Below 1 is a genuine shadow, deepened by an extra gamma so the paint
  // sits INTO the surface instead of floating flat on top of it. Above 1 is
  // sunlight, which should make the swatch BRIGHTER — not wash it out.
  float3 fd = pow(min(form, float3(1.0)), float3(1.0 + SHADOW_DEPTH * preserve));
  float3 fu = max(form, float3(1.0));
  float3 lit = targetColor * fd * fu;

  // Rescale by the peak channel rather than clipping it. A hard clamp pins the
  // brightest channel at 1 while the others stay put, which drags the hue toward
  // white and drains the colour exactly where the sun hits — that is what makes
  // light swatches read as bare, unpainted plaster. Dividing by the peak keeps
  // the ratio between channels, so the colour survives at full chroma however
  // bright the face is.
  float pk = max(max(lit.r, lit.g), lit.b);
  paint = lit / max(pk, 1.0);
  paint = mix(paint, float3(1.0), HI_WHITE * clamp(pk - 1.0, 0.0, 1.0));

  // DETAIL: everything the form blur smoothed away. Applied as a RATIO, not
  // added. The ratio is L/B specifically, so that form (B/baseL) times detail
  // (L/B) reconstructs the photo's own shading, L/baseL — which is what
  // preserving its light has to mean.
  float rel = max(L, 0.004) / max(B, 0.04);
  // A soft knee, not a clip, taken in the log domain so it limits a RATIO by
  // e-folds rather than by an absolute luminance. B is blurred across
  // boundaries, so L/B goes wild next to a window or a doorway; this saturates
  // smoothly instead of leaving a flat plateau wherever the detail clipped.
  float lr = log(rel);
  lr = lr / (1.0 + abs(lr) / DETAIL_KNEE);
  paint *= exp(lr * DETAIL_GAIN * preserve);
  paint = mix(float3(luma(paint)), paint, SAT);
  return paint;
}

/** paintAt plus grain, clamped — the finished colour, before the lift. */
float3 surfaceAt(float2 xy, float3 src) {
  float3 paint = paintAt(xy, src);
  if (grain > 0.0001) {
    // Signed, ~zero-mean noise. Scaled up a little on brighter paint so it reads
    // as surface texture without muddying shadow recesses.
    paint += (hash(xy) - 0.5) * grain * (0.5 + 0.5 * luma(paint));
  }
  return clamp(paint, 0.0, 1.0);
}
`;

/**
 * Photo in, painted photo out — opaque everywhere, the region recoloured.
 *
 * For the single-surface canvases (the before/after wipe, thumbnails). Where
 * several surfaces have to show at once, the overlay variant below is what
 * stacks them.
 */
export const RECOLOR_SKSL = `${RECOLOR_COMMON}
half4 main(float2 xy) {
  float3 src = float3(image.eval(xy).rgb);
  float coverage = coverageAt(xy);
  float3 painted = mix(brighten(src), brighten(surfaceAt(xy, src)), coverage * strength);
  return half4(half3(painted), half(1.0));
}
`;

/**
 * The same paint, but transparent outside the mask and premultiplied, so any
 * number of surfaces can be stacked over one base photo with src-over blending
 * and each paints only its own wall.
 */
export const RECOLOR_OVERLAY_SKSL = `${RECOLOR_COMMON}
half4 main(float2 xy) {
  float3 src = float3(image.eval(xy).rgb);
  float a = coverageAt(xy) * strength;
  float3 painted = brighten(surfaceAt(xy, src));
  return half4(half3(painted * a), half(a));
}
`;

/**
 * Whole-image brighten with nothing painted — the base pass under the overlays.
 *
 * The website runs its base photo through the same shader with `u_useMask = 0`
 * so the lift is the identical gamma on both halves of the picture. Splitting it
 * out here keeps that guarantee without asking the base pass to carry a mask and
 * a form layer it has no use for.
 */
export const BRIGHTEN_SKSL = `
uniform shader image;
uniform float bright;

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  if (bright <= 1.001) return src;
  return half4(half3(pow(max(float3(src.rgb), 0.0), float3(1.0 / bright))), src.a);
}
`;
