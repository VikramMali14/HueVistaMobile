import { apiFetch } from './client';
import { authResponseSchema, userProfileSchema, messageSchema, AuthResponse, UserProfile } from './schemas';

/** POST /api/auth/login — email + password. */
export interface LoginBody {
  email: string;
  password: string;
}

/** POST /api/auth/register — customer or retailer trial signup (PLAN.md §5). */
export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  /** Present only for a retailer trial signup; provisions a RETAILER org. */
  shopName?: string;
  city?: string;
  state?: string;
  phone?: string;
  /** "starter" | "pro" | "business" trial tier. */
  tier?: string;
  /** "customer" → CUSTOMER account; otherwise RETAILER. */
  accountType?: string;
}

export const authApi = {
  login(body: LoginBody): Promise<AuthResponse> {
    return apiFetch('/auth/login', { method: 'POST', json: body, skipAuth: true }).then((d) =>
      authResponseSchema.parse(d),
    );
  },

  register(body: RegisterBody): Promise<AuthResponse> {
    return apiFetch('/auth/register', { method: 'POST', json: body, skipAuth: true }).then((d) =>
      authResponseSchema.parse(d),
    );
  },

  /** Token rotation: the response carries a NEW refresh token — persist it. */
  refresh(refreshToken: string): Promise<AuthResponse> {
    return apiFetch('/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
      skipAuth: true,
      skipRefresh: true,
    }).then((d) => authResponseSchema.parse(d));
  },

  logout(): Promise<void> {
    return apiFetch('/auth/logout', { method: 'POST' }).then(() => undefined);
  },

  profile(): Promise<UserProfile> {
    return apiFetch('/auth/profile').then((d) => userProfileSchema.parse(d));
  },

  forgotPassword(email: string): Promise<string> {
    return apiFetch('/auth/forgot-password', { method: 'POST', json: { email }, skipAuth: true })
      .then((d) => messageSchema.parse(d).message);
  },
};
