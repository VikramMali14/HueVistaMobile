import {
  defaultBrightness,
  paintBrandSchema,
  paintLineSchema,
  PRODUCT_CATEGORIES,
  QUALITY_TIERS,
} from './catalogueSchemas';
import { shopProductSchema } from './accountSchemas';

describe('paintBrandSchema', () => {
  it('parses a brand', () => {
    const b = paintBrandSchema.parse({ id: 3, name: 'Asian Paints', slug: 'asian-paints' });
    expect(b.id).toBe(3);
    expect(b.slug).toBe('asian-paints');
  });

  it('tolerates a brand with no slug', () => {
    expect(paintBrandSchema.parse({ id: 1, name: 'Local Co' }).slug).toBeUndefined();
  });

  it('rejects a brand with no id — it is the path segment lines are fetched by', () => {
    expect(() => paintBrandSchema.parse({ name: 'Nameless' })).toThrow();
  });
});

describe('paintLineSchema', () => {
  it('parses a line', () => {
    const l = paintLineSchema.parse({
      id: 12,
      name: 'Royale',
      category: 'INTERIOR',
      qualityTier: 'LUXURY',
      defaultFinish: 'Matt',
    });
    expect(l.name).toBe('Royale');
    expect(l.qualityTier).toBe('LUXURY');
  });

  it('parses a line the catalogue has not classified yet', () => {
    const l = paintLineSchema.parse({ id: 4, name: 'Basic Emulsion' });
    expect(l.category).toBeUndefined();
    expect(l.defaultFinish).toBeUndefined();
  });
});

describe('defaultBrightness', () => {
  // These mirror QualityTier.defaultBrightness() on the backend. If the two
  // sides drift, the slider jumps the moment a saved listing is reloaded.
  it('matches the backend score for every tier', () => {
    expect(defaultBrightness('ECONOMY')).toBe(4);
    expect(defaultBrightness('PREMIUM')).toBe(8);
    expect(defaultBrightness('LUXURY')).toBe(10);
  });

  it('answers within the 1–10 scale the backend validates', () => {
    for (const tier of QUALITY_TIERS) {
      const n = defaultBrightness(tier);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

describe('enum lists', () => {
  it('covers both sides of the wall', () => {
    expect([...PRODUCT_CATEGORIES]).toEqual(['INTERIOR', 'EXTERIOR']);
  });

  it('covers every quality band', () => {
    expect([...QUALITY_TIERS]).toEqual(['ECONOMY', 'PREMIUM', 'LUXURY']);
  });
});

describe('shopProductSchema', () => {
  it('reads a price whichever way BigDecimal arrives', () => {
    // Jackson serialises BigDecimal as a bare number or a quoted string
    // depending on configuration, and the products list has to render both.
    expect(shopProductSchema.parse({ id: 'p1', price: 2400 }).price).toBe(2400);
    expect(shopProductSchema.parse({ id: 'p2', price: '2400.50' }).price).toBe('2400.50');
  });

  it('parses a listing with nothing but its id and line', () => {
    const p = shopProductSchema.parse({ id: 'p3', lineId: 9 });
    expect(p.lineId).toBe(9);
    expect(p.price).toBeUndefined();
    expect(p.brightness).toBeUndefined();
  });

  it('keeps the fields the products screen renders', () => {
    const p = shopProductSchema.parse({
      id: 'p4',
      lineId: 12,
      brandName: 'Asian Paints',
      lineName: 'Royale',
      category: 'INTERIOR',
      price: 2400,
      priceUnit: '20 L',
      coverage: '120 sq ft/L',
      finish: 'Matt',
      qualityTier: 'LUXURY',
      brightness: 10,
    });
    expect(p.brandName).toBe('Asian Paints');
    expect(p.category).toBe('INTERIOR');
    expect(p.brightness).toBe(10);
  });
});
