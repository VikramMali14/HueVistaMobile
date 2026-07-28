import { z } from 'zod';
import { authResponseSchema } from './schemas';

/**
 * Wire schemas for the account module — from `com.gridstore.huevista.account.dto`,
 * verified against `AccessCodeController` / `CustomerEntitlementController`.
 *
 * These cover what a shop hands a customer: the code itself, the projects and
 * products assigned on it, and the shop's own way of presenting shade codes.
 */

/** ShopProductResponse — one product a shop stocks (`paint.dto`). */
export const shopProductSchema = z.object({
  id: z.string(),
  lineId: z.number().nullish(),
  brandName: z.string().nullish(),
  lineName: z.string().nullish(),
  category: z.string().nullish(),
  price: z.union([z.number(), z.string()]).nullish(), // BigDecimal on the wire
  priceUnit: z.string().nullish(),
  packSize: z.string().nullish(),
  coverage: z.string().nullish(),
  finish: z.string().nullish(),
  qualityTier: z.string().nullish(),
  /** 1–10 brightness scale. */
  brightness: z.number().nullish(),
  imageUrl: z.string().nullish(),
  features: z.string().nullish(),
  description: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type ShopProduct = z.infer<typeof shopProductSchema>;

/**
 * AccessCodeResponse. A code now carries a project quota (the shop reserves an
 * image credit per assigned project) and the companies / products it unlocks, so
 * the customer's screens can count down what is left of it.
 */
export const accessCodeResponseSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  organizationId: z.string().nullish(),
  organizationName: z.string().nullish(),
  validDays: z.number().nullish(),
  expiresAt: z.string().nullish(),
  used: z.boolean().nullish(),
  expired: z.boolean().nullish(),
  revoked: z.boolean().nullish(),
  usedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  /** The customer this code was issued to, as the shop typed it. */
  customerName: z.string().nullish(),
  projectQuota: z.number().nullish(),
  projectsUsed: z.number().nullish(),
  projectsRemaining: z.number().nullish(),
  /** Paint companies unlocked. Empty = every brand. */
  allowedBrands: z.array(z.string()).nullish(),
  allowedProductIds: z.array(z.string()).nullish(),
  assignedProducts: z.array(shopProductSchema).nullish(),
  extendedAt: z.string().nullish(),
  extensionCount: z.number().nullish(),
});
export type AccessCodeResponse = z.infer<typeof accessCodeResponseSchema>;

/**
 * RedeemAccountResponse — `POST /api/access-codes/redeem-account` (public).
 * Redeeming a shop code with no login auto-provisions a passwordless CUSTOMER
 * account, named as the shop entered it, and returns a full session.
 */
export const redeemAccountResponseSchema = authResponseSchema.extend({
  shopName: z.string().nullish(),
  validDays: z.number().nullish(),
  customerName: z.string().nullish(),
});
export type RedeemAccountResponse = z.infer<typeof redeemAccountResponseSchema>;

/**
 * CustomerEntitlementResponse — `GET /api/me/entitlement`. The customer's project
 * allowance and access window, both set by the shop that onboarded them.
 */
export const customerEntitlementSchema = z.object({
  customerId: z.string(),
  customerName: z.string().nullish(),
  /** Absent for an account provisioned from a code — its address is synthetic. */
  customerEmail: z.string().nullish(),
  retailerOrgId: z.string().nullish(),
  accessExpiresAt: z.string().nullish(),
  expired: z.boolean().default(false),
  projectAllowance: z.number().default(0),
  projectsCreated: z.number().default(0),
  projectsRemaining: z.number().default(0),
  updatedAt: z.string().nullish(),
});
export type CustomerEntitlement = z.infer<typeof customerEntitlementSchema>;

/** AssignedProductsResponse — `GET /api/me/assigned-products`. */
export const assignedProductsSchema = z.object({
  shopName: z.string().nullish(),
  /** Whole companies unlocked. Empty/absent = no company restriction. */
  allowedBrands: z.array(z.string()).nullish(),
  products: z.array(shopProductSchema).default([]),
});
export type AssignedProducts = z.infer<typeof assignedProductsSchema>;

/**
 * ShadeCodeSchemeResponse — `GET /api/me/shade-code-scheme`. How the caller's shop
 * presents a colour: its code pattern, and whether paint names are shown at all.
 */
export const shadeCodeSchemeSchema = z.object({
  prefix: z.string().default(''),
  infix: z.string().default(''),
  suffix: z.string().default(''),
  /** False when this shop hides paint names everywhere a colour is shown. */
  showNames: z.boolean().default(true),
  updatedAt: z.string().nullish(),
});
export type ShadeCodeScheme = z.infer<typeof shadeCodeSchemeSchema>;
