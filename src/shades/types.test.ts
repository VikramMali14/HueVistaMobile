import { hexOnlyShade, isCatalogueShade, summaryToShade } from './types';
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

describe('isCatalogueShade', () => {
  const base = { name: 'Dusk', hex: '#8899aa', brand: '', family: '' };

  it('is true for a shade with a code behind it', () => {
    expect(isCatalogueShade({ ...base, code: '8071' })).toBe(true);
  });

  it('is false for a colour the model matched to no product', () => {
    expect(isCatalogueShade(hexOnlyShade('#8899aa', 'Primary'))).toBe(false);
  });

  it('does not mistake whitespace for a code', () => {
    expect(isCatalogueShade({ ...base, code: '  ' })).toBe(false);
  });

  it('never stands a codeless colour up behind the em dash the panel prints', () => {
    // The bug this replaced: a suggestion with no catalogue match was given the
    // em dash the swatch shows, so "—" reached PUT /projects/{id}/regions as a
    // shade code and "Recently used" as a shade to go back to.
    expect(hexOnlyShade('#8899aa', 'Accent').code).not.toBe('—');
    expect(isCatalogueShade(hexOnlyShade('#8899aa', 'Accent'))).toBe(false);
  });
});

describe('hexOnlyShade', () => {
  it('keeps the colour and the role, and claims no brand', () => {
    expect(hexOnlyShade('#112233', 'Trim')).toEqual({
      code: '',
      name: 'Trim',
      hex: '#112233',
      brand: '',
      family: '',
    });
  });
});
