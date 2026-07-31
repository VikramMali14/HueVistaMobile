import { z } from 'zod';

/**
 * Wire schemas for the auth module, mirrored from the backend DTOs
 * (HueVista `com.gridstore.huevista.auth.dto`). Validating responses here means
 * a backend shape change surfaces as a clear error at the boundary, not as an
 * `undefined` deep inside a screen.
 */

/** Backend `UserRole` enum (PLAN.md §1). ADMIN never reaches mobile UI. */
export const USER_ROLES = ['ADMIN', 'DISTRIBUTOR', 'RETAILER', 'PAINTER', 'CUSTOMER'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

/** AuthResponse.UserInfo — the compact user returned alongside tokens. */
export const userInfoSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  picture: z.string().nullish(),
  provider: z.string().nullish(),
  role: userRoleSchema,
});
export type UserInfo = z.infer<typeof userInfoSchema>;

/** AuthResponse — returned by register / login / refresh / otp / oauth exchange. */
export const authResponseSchema = z.object({
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  tokenType: z.string().default('Bearer'),
  expiresIn: z.number().default(0),
  user: userInfoSchema.nullish(),
  // Present + true for ADMIN 2FA; tokens are null in that case.
  twoFactorRequired: z.boolean().nullish(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** UserProfileResponse — GET /api/auth/profile. */
export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  picture: z.string().nullish(),
  provider: z.string().nullish(),
  role: userRoleSchema,
  emailVerified: z.boolean().default(false),
  phoneNumber: z.string().nullish(),
  phoneVerified: z.boolean().default(false),
  createdAt: z.string().nullish(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/** Simple `{ message }` envelope used by forgot/reset/logout endpoints. */
export const messageSchema = z.object({ message: z.string() });

/**
 * VerificationStatusResponse — the answer to "send me a code".
 *
 * `destination` is already masked by the backend, so it is safe to print: it
 * tells the user WHICH address or number the code went to without republishing
 * it in full on a screen someone may be standing over.
 */
export const verificationStatusSchema = z.object({
  /** "EMAIL" or "SMS". */
  channel: z.string().nullish(),
  /** Masked address/number the code was sent to, e.g. "v•••@gmail.com". */
  destination: z.string().nullish(),
  expiresInSeconds: z.number().default(0),
  /** How long before another code may be requested. */
  cooldownSeconds: z.number().default(0),
});
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
