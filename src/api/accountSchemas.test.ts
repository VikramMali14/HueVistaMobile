import {
  accessCodeResponseSchema,
  assignedProductsSchema,
  customerEntitlementSchema,
  redeemAccountResponseSchema,
  shadeCodeSchemeSchema,
} from './accountSchemas';
import { projectPurchaseOptionsSchema } from './billing';

describe('customerEntitlementSchema', () => {
  it('parses a shop-managed customer with projects left', () => {
    const e = customerEntitlementSchema.parse({
      customerId: 'u1',
      customerName: 'Anita',
      retailerOrgId: 'org1',
      accessExpiresAt: '2026-08-05T10:00:00',
      expired: false,
      projectAllowance: 3,
      projectsCreated: 1,
      projectsRemaining: 2,
    });
    expect(e.projectsRemaining).toBe(2);
    expect(e.expired).toBe(false);
  });

  it('tolerates the missing e-mail of a code-provisioned account', () => {
    const e = customerEntitlementSchema.parse({ customerId: 'u1' });
    expect(e.customerEmail).toBeUndefined();
    expect(e.projectAllowance).toBe(0);
  });
});

describe('accessCodeResponseSchema', () => {
  it('carries the code’s project quota and assigned products', () => {
    const c = accessCodeResponseSchema.parse({
      id: 'c1',
      code: '7K2NQ9PX',
      organizationName: 'Shree Paints',
      customerName: 'Anita',
      projectQuota: 2,
      projectsUsed: 1,
      projectsRemaining: 1,
      allowedBrands: ['Asian Paints'],
      assignedProducts: [{ id: 'p1', lineName: 'Royale', brightness: 8 }],
    });
    expect(c.projectsRemaining).toBe(1);
    expect(c.assignedProducts?.[0].brightness).toBe(8);
  });
});

describe('assignedProductsSchema', () => {
  it('defaults products to an empty list', () => {
    const a = assignedProductsSchema.parse({ shopName: 'Shree Paints' });
    expect(a.products).toEqual([]);
  });
});

describe('shadeCodeSchemeSchema', () => {
  it('shows names by default when the shop has no scheme', () => {
    const s = shadeCodeSchemeSchema.parse({});
    expect(s).toMatchObject({ prefix: '', infix: '', suffix: '', showNames: true });
  });

  it('carries a shop that hides paint names', () => {
    const s = shadeCodeSchemeSchema.parse({ prefix: 'AB', infix: 'XY', suffix: '', showNames: false });
    expect(s.showNames).toBe(false);
  });
});

describe('redeemAccountResponseSchema', () => {
  it('parses the session a no-login redeem hands back', () => {
    const r = redeemAccountResponseSchema.parse({
      accessToken: 'a',
      refreshToken: 'r',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u1', name: 'Anita', role: 'CUSTOMER' },
      shopName: 'Shree Paints',
      validDays: 10,
      customerName: 'Anita',
    });
    expect(r.user?.role).toBe('CUSTOMER');
    expect(r.shopName).toBe('Shree Paints');
  });
});

describe('projectPurchaseOptionsSchema', () => {
  it('parses a project priced on both rails', () => {
    const o = projectPurchaseOptionsSchema.parse({
      subscribed: true,
      pricingPlan: 'STARTER',
      projectPricePoints: 65,
      projectPricePaise: 6500,
      reopenPricePoints: 9,
      reopenPricePaise: 1000,
      pointsBalance: 120,
      validDays: 10,
      availableCredits: 1,
    });
    expect(o.pricingPlan).toBe('STARTER');
    expect(o.projectPricePoints).toBe(65);
    expect(o.reopenPricePoints).toBe(9);
    expect(o.pointsBalance).toBe(120);
    expect(o.availableCredits).toBe(1);
  });

  it('reads an account with no plan and no points as all-zero rather than throwing', () => {
    const o = projectPurchaseOptionsSchema.parse({});
    expect(o.subscribed).toBe(false);
    expect(o.pricingPlan).toBe('FREE');
    expect(o.pointsBalance).toBe(0);
  });
});
