import { recommendationResponseSchema, matchedShadeSchema } from './recommendationSchemas';
import { shareResponseSchema } from './projectSchemas';
import { accessCodeResponseSchema } from './accountSchemas';

describe('recommendationResponseSchema', () => {
  it('parses three palettes with matched shades', () => {
    const r = recommendationResponseSchema.parse({
      projectId: 'proj_1',
      imageType: 'INDOOR',
      combinations: [
        {
          name: 'Calm Modern',
          rationale: 'Soft neutrals with a cool accent.',
          primaryHex: '#d8d2c4',
          primaryShade: { shadeCode: '9436', name: 'Misty Dawn', hexCode: '#d8d2c4', brand: 'Asian Paints', deltaE: 1.2 },
          accentHex: '#4d5b83',
          accentShade: { shadeCode: '4408', deltaE: 0.8 },
        },
      ],
    });
    expect(r.combinations).toHaveLength(1);
    expect(r.combinations[0].primaryShade?.shadeCode).toBe('9436');
  });

  it('defaults combinations to an empty array', () => {
    expect(recommendationResponseSchema.parse({ projectId: 'p' }).combinations).toEqual([]);
  });

  it('requires a shade code on a matched shade', () => {
    expect(() => matchedShadeSchema.parse({ name: 'no code' })).toThrow();
  });
});

describe('shareResponseSchema', () => {
  it('parses a share link', () => {
    const s = shareResponseSchema.parse({
      shareUrl: 'https://huevista.app/s/abc123',
      shareToken: 'abc123',
      expiresAt: '2026-08-01T00:00:00',
    });
    expect(s.shareUrl).toContain('huevista');
  });

  it('requires a shareUrl', () => {
    expect(() => shareResponseSchema.parse({ shareToken: 'x' })).toThrow();
  });
});

describe('accessCodeResponseSchema', () => {
  it('parses a redeemed code with the shop name', () => {
    const c = accessCodeResponseSchema.parse({
      id: 'ac_1',
      code: 'HV-4821KP',
      organizationName: 'Sharma Paints',
      validDays: 7,
      used: true,
    });
    expect(c.organizationName).toBe('Sharma Paints');
    expect(c.used).toBe(true);
  });
});
