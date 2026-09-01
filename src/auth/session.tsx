import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { authApi, LoginBody, RegisterBody, setAuthHooks, ApiError } from '../api';
import { GOOGLE_AUTH_URL, OAUTH_REDIRECT_URI } from '../api/config';
import { AuthResponse, UserInfo, UserRole } from '../api/schemas';
import { tokenStore } from './tokenStore';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionValue {
  status: SessionStatus;
  user: UserInfo | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: RegisterBody) => Promise<void>;
  /**
   * Continue with Google. Resolves `false` when the user backed out of the
   * browser sheet — a dismissal is not a failure and must not raise an error on
   * the sign-in screen.
   */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Owns the auth lifecycle: restores a session from the stored refresh token on
 * launch, exposes sign-in/up/out, and wires the API client's refresh hooks so a
 * 401 anywhere triggers a single-flight token refresh.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  // useState setters are referentially stable, so the hooks registered once
  // below always call the live setters — no ref mirror needed.
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<UserInfo | null>(null);

  /** Persist tokens + user from any AuthResponse. Throws on 2FA / missing tokens. */
  const applyAuth = useCallback((res: AuthResponse) => {
    if (res.twoFactorRequired) {
      throw new ApiError({
        message: 'Admin accounts sign in on the web.',
        status: 403,
        code: 'TWO_FACTOR_REQUIRED',
      });
    }
    if (!res.accessToken || !res.refreshToken || !res.user) {
      throw new ApiError({ message: 'Unexpected sign-in response.', status: 500 });
    }
    tokenStore.setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
    // Fire-and-forget keystore write; the in-memory access token already works.
    return tokenStore.setRefreshToken(res.refreshToken);
  }, []);

  /** Exchange the stored refresh token (rotating it). Used by the 401 hook. */
  const doRefresh = useCallback(async (): Promise<string> => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) throw new ApiError({ message: 'No session.', status: 401 });
    const res = await authApi.refresh(refreshToken);
    if (!res.accessToken || !res.refreshToken) {
      throw new ApiError({ message: 'Refresh failed.', status: 401 });
    }
    tokenStore.setAccessToken(res.accessToken);
    await tokenStore.setRefreshToken(res.refreshToken);
    if (res.user) setUser(res.user);
    return res.accessToken;
  }, []);

  // Register client hooks exactly once.
  useEffect(() => {
    setAuthHooks({
      getAccessToken: () => tokenStore.getAccessToken(),
      refreshTokens: () => doRefresh(),
      onAuthFailure: () => {
        void tokenStore.clear();
        setUser(null);
        setStatus('unauthenticated');
      },
    });
  }, [doRefresh]);

  // Restore session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        await doRefresh();
        if (!cancelled) setStatus('authenticated');
      } catch {
        await tokenStore.clear();
        if (!cancelled) setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doRefresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password } satisfies LoginBody);
      await applyAuth(res);
    },
    [applyAuth],
  );

  const signUp = useCallback(
    async (body: RegisterBody) => {
      const res = await authApi.register(body);
      await applyAuth(res);
    },
    [applyAuth],
  );

  /**
   * Continue with Google, via the backend's own OAuth flow.
   *
   * `openAuthSessionAsync` is what makes this a sign-in rather than a detour: it
   * opens the sheet in a browser that shares the system cookie jar (so a phone
   * already signed in to Google takes one tap), and it closes itself the moment
   * the redirect hits our scheme, handing the URL straight back here. The
   * fragment carries a one-minute single-use code, never tokens — the same shape
   * the website's callback page trades in.
   */
  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    const result = await WebBrowser.openAuthSessionAsync(GOOGLE_AUTH_URL, OAUTH_REDIRECT_URI);
    // 'cancel' is the sheet swiped away, 'dismiss' the app coming back without a
    // redirect. Both mean "changed my mind", and neither is worth an error.
    if (result.type !== 'success') return false;

    const params = fragmentParams(result.url);
    const code = params.get('code');
    if (!code) {
      throw new ApiError({
        message:
          params.get('error') === 'google'
            ? 'Google could not sign you in. Please try again.'
            : 'Unexpected sign-in response.',
        status: 401,
      });
    }
    await applyAuth(await authApi.exchangeOAuthCode(code));
    return true;
  }, [applyAuth]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: revoke server-side, but always clear locally.
    }
    await tokenStore.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [status, user, signIn, signUp, signInWithGoogle, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * The `#a=b&c=d` half of a redirect URL.
 *
 * The code comes back in the fragment rather than the query deliberately: a
 * fragment is never sent to a server, so it stays out of access logs and
 * proxies on the way. `URL` in Hermes does not parse a custom scheme reliably,
 * so this reads the string directly.
 */
function fragmentParams(url: string): URLSearchParams {
  const hash = url.indexOf('#');
  return new URLSearchParams(hash === -1 ? '' : url.slice(hash + 1));
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
