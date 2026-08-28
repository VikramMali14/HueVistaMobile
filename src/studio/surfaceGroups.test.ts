import type { Region } from '../api';
import { summariseSurfaces, SUMMARY_SWATCHES } from './surfaceGroups';

function region(over: Partial<Region> & { id: number }): Region {
  return {
    label: null,
    category: null,
    maskData: null,
    maskUrl: null,
    appliedShadeCode: null,
    appliedHexCode: null,
    displayOrder: null,
    manual: false,
    ...over,
  };
}

const bare = () => null;

describe('summariseSurfaces', () => {
  it('collapses the three wall categories into one group', () => {
    const groups = summariseSurfaces(
      [
        region({ id: 1, category: 'MAIN_WALL' }),
        region({ id: 2, category: 'ACCENT_WALL' }),
        region({ id: 3, category: 'OTHER_WALL' }),
      ],
      bare,
    );
    expect(groups).toEqual([{ label: 'Walls', count: 3, hexes: [] }]);
  });

  it('keeps ceilings and trim apart from walls', () => {
    const groups = summariseSurfaces(
      [
        region({ id: 1, category: 'MAIN_WALL' }),
        region({ id: 2, category: 'CEILING' }),
        region({ id: 3, category: 'TRIM' }),
      ],
      bare,
    );
    expect(groups.map((g) => g.label)).toEqual(['Walls', 'Ceiling', 'Trim']);
  });

  it('treats a region with no category as one marked by hand', () => {
    expect(summariseSurfaces([region({ id: 1 })], bare)[0].label).toBe('Marked by hand');
  });

  it('files a category the phone does not know under Other rather than dropping it', () => {
    const groups = summariseSurfaces([region({ id: 1, category: 'SKIRTING_BOARD' })], bare);
    expect(groups).toEqual([{ label: 'Other', count: 1, hexes: [] }]);
  });

  it('matches the category case-insensitively', () => {
    expect(summariseSurfaces([region({ id: 1, category: 'ceiling' })], bare)[0].label).toBe('Ceiling');
  });

  it('carries the colours applied to a group', () => {
    const groups = summariseSurfaces(
      [
        region({ id: 1, category: 'MAIN_WALL' }),
        region({ id: 2, category: 'MAIN_WALL' }),
      ],
      (r) => (r.id === 1 ? { hex: '#aabbcc' } : null),
    );
    expect(groups[0]).toEqual({ label: 'Walls', count: 2, hexes: ['#aabbcc'] });
  });

  it('counts every surface but shows only the first few colours', () => {
    const regions = Array.from({ length: SUMMARY_SWATCHES + 2 }, (_, i) =>
      region({ id: i, category: 'MAIN_WALL' }),
    );
    const groups = summariseSurfaces(regions, () => ({ hex: '#123456' }));
    expect(groups[0].count).toBe(SUMMARY_SWATCHES + 2);
    expect(groups[0].hexes).toHaveLength(SUMMARY_SWATCHES);
  });

  it('is empty for a room with no surfaces', () => {
    expect(summariseSurfaces([], bare)).toEqual([]);
  });
});
