import {
  chroma,
  depthFromLrv,
  depthOf,
  hexToLab,
  hexToRgb,
  inkOn,
  labHue,
  lrvFromHex,
  lrvOf,
  undertone,
} from './colorScience';

describe('hex parsing', () => {
  it('reads long and short form, with or without the hash', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('falls back to black on junk rather than NaN-ing downstream', () => {
    expect(hexToRgb('not a colour')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#12345')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('Lab', () => {
  it('puts white and black at the ends of L', () => {
    expect(hexToLab('#ffffff').L).toBeCloseTo(100, 0);
    expect(hexToLab('#000000').L).toBeCloseTo(0, 0);
  });

  it('reads greys as having no chroma', () => {
    expect(chroma(hexToLab('#808080'))).toBeLessThan(1);
  });

  it('puts hue angles where CIELAB says they are', () => {
    // Anchors quoted in the undertone bands: red ≈ 40°, yellow ≈ 102°.
    expect(labHue(hexToLab('#ff0000'))).toBeGreaterThan(30);
    expect(labHue(hexToLab('#ff0000'))).toBeLessThan(50);
    expect(labHue(hexToLab('#ffff00'))).toBeGreaterThan(90);
    expect(labHue(hexToLab('#ffff00'))).toBeLessThan(115);
  });
});

describe('LRV', () => {
  it('spans 0–100 from black to white', () => {
    expect(lrvFromHex('#000000')).toBe(0);
    expect(lrvFromHex('#ffffff')).toBe(100);
  });

  it('prefers the brand’s measurement over the hex', () => {
    // A catalogue hex is a screen approximation; the measured value wins.
    expect(lrvOf({ hexCode: '#ffffff', lrv: 82 })).toBe(82);
    expect(lrvOf({ hexCode: '#ffffff', lrv: '82.4' })).toBe(82);
  });

  it('derives from the hex when no measurement was imported', () => {
    expect(lrvOf({ hexCode: '#ffffff', lrv: null })).toBe(100);
    expect(lrvOf({ hexCode: '#ffffff' })).toBe(100);
  });

  it('is null only when there is no colour at all', () => {
    expect(lrvOf({ hexCode: null, lrv: null })).toBeNull();
  });

  it('ignores an unparseable measurement instead of returning NaN', () => {
    expect(lrvOf({ hexCode: '#000000', lrv: 'n/a' })).toBe(0);
  });
});

describe('depth', () => {
  it('bands on the same cut points as the website', () => {
    expect(depthFromLrv(100)).toBe('light');
    expect(depthFromLrv(60)).toBe('light');
    expect(depthFromLrv(59)).toBe('medium');
    expect(depthFromLrv(25)).toBe('medium');
    expect(depthFromLrv(24)).toBe('dark');
    expect(depthFromLrv(0)).toBe('dark');
  });

  it('trusts the brand’s own tonality when it has one', () => {
    // A near-white hex that the brand nonetheless files as dark.
    expect(depthOf({ hexCode: '#f5f2ec', tonality: 'dark' })).toBe('dark');
    expect(depthOf({ hexCode: '#f5f2ec', tonality: 'DARK' })).toBe('dark');
    expect(depthOf({ hexCode: '#f5f2ec', tonality: ' Medium ' })).toBe('medium');
  });

  it('falls back to the LRV when tonality is missing or unrecognised', () => {
    expect(depthOf({ hexCode: '#ffffff', tonality: null })).toBe('light');
    expect(depthOf({ hexCode: '#111111', tonality: 'charcoal' })).toBe('dark');
  });

  it('is null with no colour to reason about', () => {
    expect(depthOf({ hexCode: null })).toBeNull();
  });
});

describe('undertone', () => {
  it('calls greys neutral', () => {
    expect(undertone('#808080')).toBe('neutral');
    expect(undertone('#f2f2f2')).toBe('neutral');
  });

  it('names the direction a saturated colour leans', () => {
    expect(undertone('#ffff00')).toBe('yellowish');
    expect(undertone('#00ff00')).toBe('greenish');
    expect(undertone('#0000ff')).toBe('bluish');
    expect(undertone('#a47148')).toBe('peachy'); // terracotta, ~63°
  });

  /**
   * Pure red sits at hue 40.00°, exactly the pinkish/peachy cut. Pinned so a
   * later tweak to the bands has to be a deliberate one — and so this reads as
   * a known edge rather than looking like a miscategorised primary.
   */
  it('resolves the pinkish/peachy boundary the same way the website does', () => {
    expect(undertone('#ff0000')).toBe('pinkish');
  });

  it('reads a warm off-white as warm, not neutral', () => {
    // The classic "why does my ceiling white look dirty" case.
    expect(undertone('#f3e8d2')).toBe('yellowish');
  });
});

describe('ink on a swatch', () => {
  it('goes dark on light paint and light on dark paint', () => {
    expect(inkOn('#ffffff').strong).toContain('26,22,18');
    expect(inkOn('#101010').strong).toContain('255,255,255');
  });
});
