import { shadeSummarySchema, shadeDetailSchema, pagedShadesSchema, brandSummarySchema } from './shadeSchemas';

describe('shadeSummarySchema', () => {
  it('parses a NON_NULL row with only a few fields present', () => {
    // Backend omits null fields, so a sparse row must still parse.
    const s = shadeSummarySchema.parse({ shadeCode: '9436', name: 'Misty Dawn', hexCode: '#d8d2c4' });
    expect(s.shadeCode).toBe('9436');
    expect(s.brandName).toBeUndefined();
  });

  it('accepts lrv as a number or a string', () => {
    expect(shadeSummarySchema.parse({ shadeCode: '1', lrv: 72.4 }).lrv).toBe(72.4);
    expect(shadeSummarySchema.parse({ shadeCode: '2', lrv: '72.4' }).lrv).toBe('72.4');
  });

  it('requires a shade code', () => {
    expect(() => shadeSummarySchema.parse({ name: 'No code' })).toThrow();
  });
});

describe('shadeDetailSchema', () => {
  it('parses AI-enriched detail fields', () => {
    const d = shadeDetailSchema.parse({
      shadeCode: '9436',
      name: 'Misty Dawn',
      hexCode: '#d8d2c4',
      styleTags: ['modern', 'calm'],
      moodDescriptors: ['serene'],
      aiDescription: 'A soft, airy neutral.',
      suitableRooms: ['bedroom'],
    });
    expect(d.styleTags).toEqual(['modern', 'calm']);
    expect(d.aiDescription).toContain('neutral');
  });
});

describe('pagedShadesSchema', () => {
  it('parses a page envelope', () => {
    const p = pagedShadesSchema.parse({
      content: [{ shadeCode: '1', hexCode: '#fff' }],
      page: 0,
      size: 120,
      totalElements: 1,
      totalPages: 1,
    });
    expect(p.content).toHaveLength(1);
    expect(p.totalElements).toBe(1);
  });
});

describe('brandSummarySchema', () => {
  it('parses a brand with its count', () => {
    const b = brandSummarySchema.parse({ name: 'Asian Paints', slug: 'asian-paints', shadeCount: 4200 });
    expect(b.slug).toBe('asian-paints');
    expect(b.shadeCount).toBe(4200);
  });
});
