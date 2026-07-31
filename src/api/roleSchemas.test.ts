import { networkReportSchema, myAccessSchema } from './orgSchemas';
import { paintJobSchema, decimal } from './painterSchemas';
import { subscriptionSchema, rewardPointsSchema } from './billing';
import { shopAccessCodeSchema } from './retailSchemas';

describe('networkReportSchema', () => {
  it('parses a nested downline', () => {
    const r = networkReportSchema.parse({
      viewerRole: 'DISTRIBUTOR',
      totals: { retailers: 2, painters: 5 },
      roots: [
        {
          userId: 'u1',
          role: 'RETAILER',
          orgId: 'o1',
          orgName: 'Shree Paints',
          codesIssued: 12,
          codesRedeemed: 9,
          children: [{ userId: 'u2', role: 'PAINTER', name: 'Ravi' }],
        },
      ],
    });
    expect(r.roots[0].orgName).toBe('Shree Paints');
    expect(r.roots[0].children[0].role).toBe('PAINTER');
    // Counts a node omits default to zero rather than undefined, so arithmetic
    // over the tree never produces NaN.
    expect(r.roots[0].children[0].codesIssued).toBe(0);
    expect(r.totals.retailers).toBe(2);
  });

  it('defaults an empty report to something safe to walk', () => {
    const r = networkReportSchema.parse({});
    expect(r.roots).toEqual([]);
    expect(r.totals).toEqual({});
  });
});

describe('myAccessSchema', () => {
  it('reads an unrestricted shop', () => {
    const a = myAccessSchema.parse({ role: 'RETAILER', orgId: 'o1' });
    expect(a.brandsRestricted).toBe(false);
    expect(a.featuresRestricted).toBe(false);
    expect(a.allowedPaths).toEqual([]);
  });

  it('carries the granted paths the tab bar filters on', () => {
    const a = myAccessSchema.parse({
      featuresRestricted: true,
      allowedFeatures: ['STUDIO'],
      allowedPaths: ['/atelier'],
    });
    expect(a.allowedPaths).toContain('/atelier');
  });
});

describe('paintJobSchema', () => {
  it('accepts BigDecimal fields as numbers or strings', () => {
    const j = paintJobSchema.parse({
      id: 'j1',
      status: 'PENDING',
      estimatedPaintLiters: '12.5',
      quotedAmountInr: 18000,
    });
    expect(decimal(j.estimatedPaintLiters)).toBe(12.5);
    expect(decimal(j.quotedAmountInr)).toBe(18000);
  });

  it('tolerates a status this build has not heard of', () => {
    // One new enum value on the backend must not blank a painter's whole list.
    expect(paintJobSchema.parse({ id: 'j1', status: 'ON_HOLD' }).status).toBe('ON_HOLD');
  });

  it('reads a missing decimal as null rather than NaN', () => {
    expect(decimal(null)).toBeNull();
    expect(decimal(undefined)).toBeNull();
    expect(decimal('not a number')).toBeNull();
  });
});

describe('subscriptionSchema', () => {
  it('parses the single project quota with its extras', () => {
    const s = subscriptionSchema.parse({
      plan: 'STARTER',
      status: 'ACTIVE',
      projectsUsed: 4,
      projectsLimit: 15,
      projectsRemaining: 11,
      reservedProjects: 2,
      purchasedProjectCredits: 1,
      carriedProjectCredits: 3,
    });
    expect(s.projectsLimit).toBe(15);
    expect(s.reservedProjects).toBe(2);
    expect(s.carriedProjectCredits).toBe(3);
  });
});

describe('rewardPointsSchema', () => {
  it('parses a balance with its expiry batches', () => {
    const p = rewardPointsSchema.parse({
      balance: 120,
      projectPrice: 65,
      reopenPrice: 9,
      lots: [{ id: 'l1', pointsRemaining: 120, expiresAt: '2027-01-01T00:00:00' }],
    });
    expect(p.balance).toBe(120);
    expect(p.lots).toHaveLength(1);
  });
});

describe('shopAccessCodeSchema', () => {
  it('carries the counter-only flags alongside the customer fields', () => {
    const c = shopAccessCodeSchema.parse({
      code: 'HV-7K2NQ9',
      projectQuota: 3,
      projectsRemaining: 2,
      editable: false,
      topUpAllowed: true,
    });
    expect(c.topUpAllowed).toBe(true);
    expect(c.editable).toBe(false);
    expect(c.projectsRemaining).toBe(2);
  });
});
