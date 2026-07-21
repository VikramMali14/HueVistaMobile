import type { ShadeSummary } from '../api/shadeSchemas';

/** A paint shade. Mirrors the fields the visualizer needs from `/api/shades`. */
export interface Shade {
  /** Brand shade code, e.g. "8071". Displayed in mono. */
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
