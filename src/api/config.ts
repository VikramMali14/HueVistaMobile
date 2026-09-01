/**
 * API origin resolution. `EXPO_PUBLIC_*` vars are inlined into the bundle at
 * build time by Expo, so this is safe to read on-device.
 *
 * Point a dev build at your machine by setting EXPO_PUBLIC_API_ORIGIN in
 * `.env` (see .env.example). On a physical device, use your LAN IP, not
 * localhost — the phone can't reach the laptop's loopback.
 */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? 'http://localhost:8080').replace(/\/+$/, '');

/** Prefix for all backend routes (they all live under /api — see PLAN.md §5). */
export const API_BASE = `${API_ORIGIN}/api`;

/**
 * Where a Google sign-in is started, and where it comes back to.
 *
 * The app has no Google SDK and no OAuth client of its own: it opens the
 * backend's own authorization entry point in a system browser session, and the
 * backend — which already runs this flow for the website — sends a short-lived,
 * single-use exchange code back to the deep link below. `client=mobile` is what
 * tells it to land on the app rather than on the website's callback page.
 *
 * The redirect must match `app.mobile.oauth-redirect-uri` on the server and the
 * `scheme` in app.json. It is overridable so a build pointed at a staging API
 * (or running under a different scheme) can agree with it without a code change.
 */
export const GOOGLE_AUTH_URL = `${API_ORIGIN}/oauth2/authorization/google?client=mobile`;

export const OAUTH_REDIRECT_URI =
  process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI ?? 'huevista://sign-in/callback';

/**
 * Where a Razorpay Checkout comes back to.
 *
 * Payment takes the same shape as the Google sign-in above, and for the same
 * reason: Checkout is a web library with no supported React Native entry point,
 * and the alternative — a payment SDK on the handset — means owning card data
 * this product has no business touching. So the app creates the order itself
 * (priced server-side, against its own session), opens the website's checkout
 * window in a browser session, and reads the result off the redirect back to
 * this scheme. The money is never decided in that browser: the app verifies the
 * outcome against the backend, which checks the signature over its own record
 * of the order.
 *
 * Must match `NEXT_PUBLIC_MOBILE_PAY_REDIRECT` on the website and the `scheme`
 * in app.json.
 */
export const PAY_REDIRECT_URI =
  process.env.EXPO_PUBLIC_PAY_REDIRECT_URI ?? 'huevista://pay/callback';

/** The website's checkout window for a Razorpay order, or null with no web origin. */
export function checkoutUrl(params: Record<string, string | number | undefined>): string | null {
  const base = webUrl('/pay/mobile');
  if (!base) return null;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}`.length > 0) q.set(k, `${v}`);
  }
  return `${base}?${q.toString()}`;
}

/**
 * The website's origin, when the build knows it.
 *
 * Payments are a Razorpay Checkout web flow and the app carries no payment SDK,
 * so buying or reopening a project hands off to the site. Unset by default: the
 * app then names the price and says where to pay rather than opening a guessed
 * URL.
 */
export const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? '').replace(/\/+$/, '');

/** An absolute website URL, or null when this build has no web origin configured. */
export function webUrl(path: string): string | null {
  if (!WEB_ORIGIN) return null;
  return `${WEB_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Resolve a backend image URL. The API returns either an absolute URL (S3) or an
 * origin-relative path (`/api/images/files/...`); both shapes end up absolute so
 * they can be handed to `fetch` or an <Image>.
 *
 * Whether the access token goes with it is a separate question — ask
 * `isApiOriginUrl`, not this.
 */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** `scheme://host[:port]`, with the scheme's default port dropped, or null. */
function originOf(url: string): string | null {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(url);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  let authority = match[2].toLowerCase();
  const defaultPort = scheme === 'https' ? ':443' : ':80';
  if (authority.endsWith(defaultPort)) {
    authority = authority.slice(0, -defaultPort.length);
  }
  return `${scheme}://${authority}`;
}

/**
 * Whether a resolved image URL should be sent WITH the access token.
 *
 * The backend returns two shapes for the same picture, and they need opposite
 * treatment:
 *
 *   - `/api/images/files/…` (local storage, the default) is auth-gated — it is
 *     served by `ImageController` behind the JWT filter, so it needs the bearer.
 *   - an absolute **S3 presigned** URL already carries its own signature in the
 *     query string. S3 rejects a request that ALSO sends an `Authorization`
 *     header with `400 InvalidArgument` — "Only one auth mechanism allowed" —
 *     so attaching the token there does not merely waste a header, it is the
 *     difference between the photo loading and a blank canvas.
 *
 * So: token only when the URL points at our own API origin. This is the same
 * distinction the website draws in `src/lib/media.ts`, where an absolute URL on
 * another origin is loaded as-is and only same-origin `/api/…` paths are routed
 * through the authenticating BFF proxy.
 */
export function isApiOriginUrl(url?: string | null): boolean {
  if (!url) return false;
  // Origin-relative paths are resolved onto API_ORIGIN by resolveImageUrl.
  if (!/^https?:\/\//i.test(url)) return true;
  const target = originOf(url);
  return target !== null && target === originOf(API_ORIGIN);
}
