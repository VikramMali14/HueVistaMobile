/**
 * The numbers that decide what a painted wall looks like, in one place, at the
 * website's values.
 *
 * These are not preferences. Each one is a knob on the recolor shader, and the
 * shader is shared with `HueVistaFrontEnd/src/lib/webgl-recolor.ts`: change one
 * here without changing it there and a shade starts meaning two different
 * colours again, which is the whole class of bug this file exists to close.
 */

/**
 * How much of the photo's own light the paint follows, 0..1.
 *
 * The website's `SHADOW_STRENGTH`, with its `SHADOW_ON` permanently true. 0
 * would be a flat sticker of the exact swatch; 1 follows every shadow the room
 * has. 0.85 is the value the site ships.
 */
export const SHADOW_STRENGTH = 0.85;

/**
 * Per-pixel noise amplitude on painted surfaces — the website's `DEFAULT_GRAIN`.
 *
 * Subtle by design: enough to break the CGI flatness of a perfectly even fill,
 * not enough to look noisy. It matters most on the walls a phone camera
 * flattens, which is most of them.
 */
export const DEFAULT_GRAIN = 0.03;

/**
 * Sharpen the mask edge to about one point rather than trusting the mask's own
 * resolution. On by default, as on the site — masks come back smaller than the
 * photo, so an unsharpened edge is several points of colour bleeding over window
 * frames and railing gaps.
 */
export const EDGE_AA = 1;

/**
 * The Brighten control: a whole-image light lift for photos shot in dim or flat
 * light, so a customer can judge colours the way the wall would read on a
 * sunnier day.
 *
 * Three fixed levels, not a slider — the website's reasoning, kept: a free
 * slider invites over-brightening, and an over-brightened photo falsifies every
 * shade laid on it. `gamma` is the midtone lift the shader applies as
 * `output = input^(1/gamma)`; a gamma lift brightens shadows and midtones while
 * leaving pure white in place, so a bright window doesn't clip to a white blob.
 */
export interface BrightenLevel {
  id: 'original' | 'soft' | 'radiant';
  label: string;
  gamma: number;
}

export const BRIGHTEN_LEVELS: readonly BrightenLevel[] = [
  { id: 'original', label: 'Original', gamma: 1 },
  { id: 'soft', label: 'Soft glow', gamma: 1.25 },
  { id: 'radiant', label: 'Radiant', gamma: 1.6 },
] as const;

export type BrightenId = BrightenLevel['id'];

export function gammaFor(id: BrightenId): number {
  return BRIGHTEN_LEVELS.find((l) => l.id === id)?.gamma ?? 1;
}
