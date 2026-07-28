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
 * origin-relative path (`/api/images/files/...`). Both image files and region
 * masks are auth-gated, so load them with the bearer token attached.
 */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
