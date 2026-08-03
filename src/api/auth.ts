import { apiFetch } from './client';
import {
  authResponseSchema,
  userProfileSchema,
  messageSchema,
  verificationStatusSchema,
  AuthResponse,
  UserProfile,
  VerificationStatus,
} from './schemas';

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

  /** Edit the account's own details. PATCH — only the named fields change. */
  updateProfile(body: { name?: string; phoneNumber?: string }): Promise<UserProfile> {
    return apiFetch('/auth/profile', { method: 'PATCH', json: body }).then((d) =>
      userProfileSchema.parse(d),
    );
  },

  changePassword(currentPassword: string, newPassword: string): Promise<string> {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      json: { currentPassword, newPassword },
    }).then((d) => messageSchema.parse(d).message);
  },

  /**
   * Delete the account for good.
   *
   * Irreversible, so every caller confirms first — the API itself asks nothing
   * beyond a valid session.
   */
  deleteAccount(): Promise<void> {
    return apiFetch('/auth/account', { method: 'DELETE' }).then(() => undefined);
  },
};

/**
 * E-mail verification.
 *
 * The backend gates project creation behind this when the feature is on, and
 * says so with a `VERIFICATION_REQUIRED` refusal — which is what sends the app to
 * the verify screen rather than leaving the user at a dead end.
 *
 * Mobile/SMS verification is deliberately absent: no SMS provider is wired up
 * yet, so `/auth/verify/phone/*` would issue a code that never reaches the
 * handset. The backend still exposes those endpoints — bring the two wrappers
 * back from git history once SMS is live.
 *
 * Verified against `VerificationController`.
 */
export const verificationApi = {
  /** Send a code to the account's e-mail address. */
  sendEmail(): Promise<VerificationStatus> {
    return apiFetch('/auth/verify/email/send', { method: 'POST' }).then((d) =>
      verificationStatusSchema.parse(d),
    );
  },

  /** Confirm the e-mailed code; returns the profile with `emailVerified` set. */
  confirmEmail(code: string): Promise<UserProfile> {
    return apiFetch('/auth/verify/email/confirm', {
      method: 'POST',
      json: { code: code.trim() },
    }).then((d) => userProfileSchema.parse(d));
  },
};
