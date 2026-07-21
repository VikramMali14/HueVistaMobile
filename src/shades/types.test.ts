import { summaryToShade } from './types';
import type { ShadeSummary } from '../api/shadeSchemas';

describe('summaryToShade', () => {
  it('maps a full summary to the compact Shade', () => {
    const summary: ShadeSummary = {
      shadeCode: '9436',
      name: 'Misty Dawn',
      hexCode: '#d8d2c4',
      brandName: 'Asian Paints',
      brandSlug: 'asian-paints',
      shadeFamily: 'Off Whites',
    };
    expect(summaryToShade(summary)).toEqual({
      code: '9436',
      name: 'Misty Dawn',
      hex: '#d8d2c4',
      brand: 'Asian Paints',
      family: 'Off Whites',
      brandSlug: 'asian-paints',
    });
  });

  it('returns null when the shade has no hex (cannot be swatched or recolored)', () => {
    expect(summaryToShade({ shadeCode: '0001' })).toBeNull();
  });

  it('falls back to the code for a missing name', () => {
    expect(summaryToShade({ shadeCode: '7', hexCode: '#111111' })?.name).toBe('7');
  });
});
