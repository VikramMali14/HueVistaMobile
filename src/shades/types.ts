import type { ShadeSummary } from '../api/shadeSchemas';

/** A paint shade. Mirrors the fields the visualizer needs from `/api/shades`. */
export interface Shade {
  /**
   * Brand shade code, e.g. "8071". Displayed in mono.
   *
   * Empty for a colour with nothing in the catalogue behind it — a hex the
   * model suggested and matched to no product, or one lifted out of a photo.
   * Test it with `isCatalogueShade` rather than against a literal: this used
   * to be the em dash the suggestion panel prints, which meant "—" travelled
   * to `PUT /projects/{id}/regions` as a real shade code and into the
   * customer's "Recently used" strip as a real shade.
   */
  code: string;
  name: string;
  /** Hex swatch color used both for the tray dot and the recolor target. */
  hex: string;
  brand: string;
  /** Color family / mood grouping, e.g. "Neutrals", "Blues". */
  family: string;
  /** Brand slug, when known — needed to fetch shade detail. */
  brandSlug?: string;
}

/**
 * Map a catalogue summary to the compact Shade the tray/visualizer use. Returns
 * null when the shade has no hex (can't be shown as a swatch or recolored).
 */
export function summaryToShade(s: ShadeSummary): Shade | null {
  if (!s.hexCode) return null;
  return {
    code: s.shadeCode,
    name: s.name ?? s.shadeCode,
    hex: s.hexCode,
    brand: s.brandName ?? '',
    family: s.shadeFamily ?? '',
    brandSlug: s.brandSlug ?? undefined,
  };
}

/**
 * Is there a product behind this colour?
 *
 * Only a catalogue shade can be saved against a region as a shade code, put on
 * a board, or taken to a counter. A codeless one is still paint on the wall —
 * it just travels as a hex and nothing more.
 */
export function isCatalogueShade(shade: Shade): boolean {
  return shade.code.trim().length > 0;
}

/** A colour with no catalogue entry — carries its hex and a name, no code. */
export function hexOnlyShade(hex: string, name: string): Shade {
  return { code: '', name, hex, brand: '', family: '' };
}
