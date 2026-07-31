import { API_ORIGIN, isApiOriginUrl, resolveImageUrl } from './config';

describe('resolveImageUrl', () => {
  it('returns null for a missing URL', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
  });

  it('makes an origin-relative backend path absolute', () => {
    expect(resolveImageUrl('/api/images/files/u1/a.jpg')).toBe(`${API_ORIGIN}/api/images/files/u1/a.jpg`);
    expect(resolveImageUrl('api/images/files/u1/a.jpg')).toBe(`${API_ORIGIN}/api/images/files/u1/a.jpg`);
  });

  it('leaves an absolute URL untouched', () => {
    const presigned = 'https://bucket.s3.ap-south-1.amazonaws.com/u1/a.jpg?X-Amz-Signature=abc';
    expect(resolveImageUrl(presigned)).toBe(presigned);
  });
});

describe('isApiOriginUrl', () => {
  it('is false without a URL', () => {
    expect(isApiOriginUrl(null)).toBe(false);
    expect(isApiOriginUrl(undefined)).toBe(false);
    expect(isApiOriginUrl('')).toBe(false);
  });

  it('is true for an origin-relative backend path', () => {
    expect(isApiOriginUrl('/api/images/files/u1/a.jpg')).toBe(true);
  });

  it('is true for an absolute URL on our own API origin', () => {
    expect(isApiOriginUrl(`${API_ORIGIN}/api/images/files/u1/a.jpg`)).toBe(true);
  });

  /**
   * The one that matters: S3 answers 400 ("Only one auth mechanism allowed")
   * when a presigned URL also carries an Authorization header, so a presigned
   * URL must never be treated as ours.
   */
  it('is false for an S3 presigned URL', () => {
    expect(
      isApiOriginUrl('https://hv-bucket.s3.ap-south-1.amazonaws.com/u1/a.jpg?X-Amz-Signature=abc'),
    ).toBe(false);
  });

  it('is false for any other host, including a lookalike prefix', () => {
    expect(isApiOriginUrl('https://cdn.example.com/a.jpg')).toBe(false);
    expect(isApiOriginUrl('http://localhost:8080.evil.com/a.jpg')).toBe(false);
  });

  it('ignores a default port and the scheme/host casing', () => {
    expect(isApiOriginUrl('HTTP://LOCALHOST:8080/api/images/files/u1/a.jpg')).toBe(
      isApiOriginUrl('http://localhost:8080/api/images/files/u1/a.jpg'),
    );
  });
});

describe('isApiOriginUrl with a configured API origin', () => {
  const original = process.env.EXPO_PUBLIC_API_ORIGIN;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_ORIGIN = original;
    jest.resetModules();
  });

  function loadWithOrigin(origin: string) {
    process.env.EXPO_PUBLIC_API_ORIGIN = origin;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./config') as typeof import('./config');
  }

  it('matches its own host over https, default port or not', () => {
    const config = loadWithOrigin('https://api.huevista.in');
    expect(config.isApiOriginUrl('https://api.huevista.in/api/images/files/u1/a.jpg')).toBe(true);
    expect(config.isApiOriginUrl('https://api.huevista.in:443/api/images/files/u1/a.jpg')).toBe(true);
    expect(config.isApiOriginUrl('https://huevista.in/api/images/files/u1/a.jpg')).toBe(false);
  });

  it('still refuses to authorize a presigned S3 URL', () => {
    const config = loadWithOrigin('https://api.huevista.in');
    expect(
      config.isApiOriginUrl('https://hv-bucket.s3.ap-south-1.amazonaws.com/u1/a.jpg?X-Amz-Signature=abc'),
    ).toBe(false);
  });
});
