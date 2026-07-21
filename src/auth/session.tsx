import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, LoginBody, RegisterBody, setAuthHooks, ApiError } from '../api';
import { AuthResponse, UserInfo, UserRole } from '../api/schemas';
import { tokenStore } from './tokenStore';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionValue {
  status: SessionStatus;
  user: UserInfo | null;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: RegisterBody) => Promise<void>;
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
    () => ({ status, user, role: user?.role ?? null, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
