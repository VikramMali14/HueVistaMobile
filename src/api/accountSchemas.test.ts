import {
  accessCodeResponseSchema,
  assignedProductsSchema,
  customerEntitlementSchema,
  redeemAccountResponseSchema,
  shadeCodeSchemeSchema,
} from './accountSchemas';
import { planSchema, pdfAllowanceSchema } from './billing';

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

describe('planSchema', () => {
  it('parses the free tier a self-serve customer is priced on', () => {
    const p = planSchema.parse({
      plan: 'FREE',
      displayName: 'Free',
      purchasable: false,
      rank: 0,
      extraProjectPriceInPaise: 19900,
      extraProjectPriceWithTaxInPaise: 23482,
      colorMatching: false,
    });
    expect(p.purchasable).toBe(false);
    expect(p.extraProjectPriceWithTaxInPaise).toBe(23482);
    expect(p.colorMatching).toBe(false);
  });

  it('reads a tier with nothing but a name rather than throwing', () => {
    const p = planSchema.parse({ plan: 'STARTER' });
    expect(p.purchasable).toBe(false);
    expect(p.extraProjectPriceWithTaxInPaise).toBe(0);
  });
});

describe('pdfAllowanceSchema', () => {
  it('parses a month with boards left', () => {
    const a = pdfAllowanceSchema.parse({
      imagesPerPdf: 4,
      monthlyLimit: 10,
      used: 3,
      remaining: 7,
    });
    expect(a.remaining).toBe(7);
    expect(a.imagesPerPdf).toBe(4);
  });

  it('reads an empty answer as no allowance at all', () => {
    expect(pdfAllowanceSchema.parse({}).remaining).toBe(0);
  });
});
