import { API_BASE } from './config';
import { ApiError, errorFromResponse, errorFromThrown } from './errors';

/**
 * Auth hooks the auth module wires in at startup. Kept as an injectable seam so
 * the client has no import cycle with the session store and stays unit-testable.
 */
export interface AuthHooks {
  /** Current in-memory access token, or null when signed out. */
  getAccessToken: () => string | null;
  /** Exchange the stored refresh token for a new access token. Resolves to the
   *  new access token, or throws if refresh is impossible (forces sign-out). */
  refreshTokens: () => Promise<string>;
  /** Called when refresh fails — session should clear and route to sign-in. */
  onAuthFailure: () => void;
}

let authHooks: AuthHooks | null = null;
/** Single-flight refresh: concurrent 401s share one refresh round-trip. */
let refreshInFlight: Promise<string> | null = null;

export function setAuthHooks(hooks: AuthHooks) {
  authHooks = hooks;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body — serialized automatically with the right content-type. */
  json?: unknown;
  /** Raw body (e.g. FormData for multipart image upload). Takes precedence. */
  body?: BodyInit;
  /** Skip attaching the Authorization header (auth endpoints, guest routes). */
  skipAuth?: boolean;
  /** Do not attempt a refresh+retry on 401 (used by the refresh call itself). */
  skipRefresh?: boolean;
  /** Abort the request after this many ms (default 20s). */
  timeoutMs?: number;
}

async function runFetch(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const { json, body, skipAuth, timeoutMs = 20_000, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  finalHeaders.set('Accept', 'application/json');
  if (!skipAuth && accessToken) {
    finalHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Core request. Attaches auth, normalizes errors, and on a 401 performs a
 * single-flight token refresh then retries the request exactly once.
 *
 * Pass a type argument for the parsed JSON; 204/empty bodies resolve to
 * `undefined`. Prefer validating the result with a zod schema at the call site.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = options.skipAuth ? null : authHooks?.getAccessToken() ?? null;

  let res: Response;
  try {
    res = await runFetch(path, options, accessToken);
  } catch (err) {
    throw errorFromThrown(err);
  }

  // 401 → refresh once, then retry.
  if (res.status === 401 && !options.skipAuth && !options.skipRefresh && authHooks) {
    try {
      const newToken = await refreshOnce(authHooks);
      res = await runFetch(path, { ...options, skipRefresh: true }, newToken);
    } catch {
      authHooks.onAuthFailure();
      throw new ApiError({ message: 'Your session has expired. Please sign in again.', status: 401 });
    }
  }

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function refreshOnce(hooks: AuthHooks): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = hooks.refreshTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
