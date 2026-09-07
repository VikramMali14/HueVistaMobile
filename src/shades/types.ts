import type { ShadeSummary } from '../api/shadeSchemas';
import { measuredLrv } from './colorScience';

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
  /**
   * The brand's MEASURED Light Reflectance Value, when the catalogue row has
   * one. Null or undefined means it does not.
   *
   * Carried through the pick because it is what the renderer paints: a
   * catalogue hex is a screen approximation, the LRV is a measurement of the
   * real paint, and the website has corrected one against the other since its
   * visualizer was written. Without this field on the way through, the phone
   * had nothing to correct with and painted the approximation.
   */
  lrv?: number | null;
  /**
   * The brand's own depth word — "light", "medium" or "dark" — when the
   * catalogue row states one.
   *
   * `depthOf` prefers it over anything derived, because it is the word the brand
   * prints on its own fan deck and the word the website shows. Carried here so a
   * swatch in a grid can be labelled from the catalogue rather than from a
   * screen approximation of the paint.
   */
  tonality?: string | null;
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
    lrv: measuredLrv(s),
    tonality: s.tonality ?? null,
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
  // No LRV on purpose: nobody measured this colour, so there is nothing to
  // correct the hex against and the hex is painted exactly as given.
  return { code: '', name, hex, brand: '', family: '', lrv: null, tonality: null };
}
