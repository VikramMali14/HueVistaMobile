import type { Region } from '../api';

/** How many surfaces of one kind, and which colours are already on them. */
export interface SurfaceGroup {
  label: string;
  count: number;
  /** The colours actually applied in this group, at most `SUMMARY_SWATCHES`. */
  hexes: string[];
}

/** At most this many swatches per row before the rest are left to the count. */
export const SUMMARY_SWATCHES = 3;

/**
 * What the server's region categories are called in front of a customer.
 *
 * The three wall categories collapse to one word on purpose: "main wall",
 * "accent wall" and "other wall" is the model's taxonomy, and a person looking
 * at their own living room counts walls.
 */
const SURFACE_LABELS: Record<string, string> = {
  MAIN_WALL: 'Walls',
  ACCENT_WALL: 'Walls',
  OTHER_WALL: 'Walls',
  CEILING: 'Ceiling',
  TRIM: 'Trim',
  MANUAL: 'Marked by hand',
};

/**
 * Group a room's surfaces by what they are, for the step-4 summary.
 *
 * Each group carries the colours that are on it, which is the one thing worth
 * showing beside a count in a product about paint. The rows used to carry a
 * category colour instead — a fixed violet for walls, warm for the ceiling,
 * sage for trim — three colours this app uses for other things entirely,
 * standing in for nothing.
 *
 * `colourOf` is passed in rather than read off the region because the screen
 * knows about swatches tapped a second ago that the server has not caught up
 * with yet, and a summary that disagrees with the photo above it is worse than
 * no summary.
 */
export function summariseSurfaces(
  regions: Region[],
  colourOf: (region: Region) => { hex: string } | null,
): SurfaceGroup[] {
  const groups = new Map<string, SurfaceGroup>();
  regions.forEach((region) => {
    const label = SURFACE_LABELS[(region.category ?? 'MANUAL').toUpperCase()] ?? 'Other';
    const group = groups.get(label) ?? { label, count: 0, hexes: [] };
    group.count += 1;
    const hex = colourOf(region)?.hex;
    if (hex && group.hexes.length < SUMMARY_SWATCHES) group.hexes.push(hex);
    groups.set(label, group);
  });
  return [...groups.values()];
}
