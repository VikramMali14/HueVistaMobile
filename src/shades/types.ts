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
}
