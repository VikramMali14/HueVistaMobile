import { authResponseSchema, userProfileSchema, userRoleSchema } from './schemas';

describe('authResponseSchema', () => {
  it('parses a full login response', () => {
    const res = authResponseSchema.parse({
      accessToken: 'a.b.c',
      refreshToken: 'r.s.t',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u1', name: 'Asha', email: 'a@x.com', picture: null, provider: 'local', role: 'CUSTOMER' },
      twoFactorRequired: null,
    });
    expect(res.accessToken).toBe('a.b.c');
    expect(res.user?.role).toBe('CUSTOMER');
  });

  it('applies defaults for tokenType and expiresIn', () => {
    const res = authResponseSchema.parse({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', role: 'RETAILER' } });
    expect(res.tokenType).toBe('Bearer');
    expect(res.expiresIn).toBe(0);
  });

  it('represents the admin 2FA branch (null tokens, flag true)', () => {
    const res = authResponseSchema.parse({ twoFactorRequired: true, accessToken: null, refreshToken: null });
    expect(res.twoFactorRequired).toBe(true);
    expect(res.accessToken).toBeNull();
  });

  it('rejects an unknown role', () => {
    expect(() => authResponseSchema.parse({ user: { id: 'u', role: 'WIZARD' } })).toThrow();
  });
});

describe('userRoleSchema', () => {
  it('accepts every backend role', () => {
    for (const role of ['ADMIN', 'DISTRIBUTOR', 'RETAILER', 'PAINTER', 'CUSTOMER']) {
      expect(userRoleSchema.parse(role)).toBe(role);
    }
  });
});

describe('userProfileSchema', () => {
  it('defaults emailVerified to false', () => {
    const p = userProfileSchema.parse({ id: 'u', role: 'PAINTER' });
    expect(p.emailVerified).toBe(false);
  });

  // The backend still sends phoneVerified; the app no longer verifies numbers,
  // so the flag is dropped rather than carried around unused.
  it('drops the backend phoneVerified flag', () => {
    const p = userProfileSchema.parse({ id: 'u', role: 'PAINTER', phoneVerified: true });
    expect('phoneVerified' in p).toBe(false);
  });
});
