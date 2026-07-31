import { z } from 'zod';
import { accessCodeResponseSchema } from './accountSchemas';

/**
 * Wire schemas for the counter-side of a shop: the codes it hands out, the
 * customers behind them, and the projects it grants.
 *
 * `AccessCodeResponse` itself already lives in `accountSchemas` (a customer sees
 * their own code too); what is added here is the shop's view of it — the fields
 * only the issuer can act on.
 */

/**
 * The shop's own view of a code it issued. Same DTO, but these three matter only
 * at the counter: whether the code can still be edited, whether more projects may
 * be added to it, and when it was revoked.
 */
export const shopAccessCodeSchema = accessCodeResponseSchema.extend({
  editable: z.boolean().nullish(),
  topUpAllowed: z.boolean().nullish(),
  revokedAt: z.string().nullish(),
});
export type ShopAccessCode = z.infer<typeof shopAccessCodeSchema>;

/**
 * ProjectGrantResponse — one "add a project" a shop performed for a customer.
 *
 * `revocable` is the shop's window to take it back: a granted project that has
 * not been spent can be returned to the shop's own allowance, which is what makes
 * granting safe to do generously.
 */
export const projectGrantSchema = z.object({
  id: z.string(),
  customerUserId: z.string().nullish(),
  accessCodeId: z.string().nullish(),
  projects: z.number().default(0),
  createdAt: z.string().nullish(),
  revokedAt: z.string().nullish(),
  revocable: z.boolean().default(false),
});
export type ProjectGrant = z.infer<typeof projectGrantSchema>;

/** RetailerComboResponse.ComboShade — one colour in a shop's saved palette. */
export const comboShadeSchema = z.object({
  code: z.string().nullish(),
  name: z.string().nullish(),
  hex: z.string().nullish(),
});

/**
 * RetailerComboResponse — a palette the shop itself put together, offered in the
 * studio's AI-suggest tab beside Claude's. `scope` picks which lead for a photo:
 * INTERIOR for a room, EXTERIOR for a building.
 */
export const retailerComboSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  organizationName: z.string().nullish(),
  name: z.string().nullish(),
  scope: z.string().nullish(),
  shades: z.array(comboShadeSchema).default([]),
  createdAt: z.string().nullish(),
});
export type RetailerCombo = z.infer<typeof retailerComboSchema>;

/** StoreLinkResponse — the shop's public kiosk link. */
export const storeLinkSchema = z.object({
  id: z.string(),
  slug: z.string(),
  organizationId: z.string().nullish(),
  organizationName: z.string().nullish(),
  /** What a walk-in pays. One flat platform price — the shop does not set it. */
  pricePaise: z.number().default(0),
  currency: z.string().default('INR'),
  validDays: z.number().default(0),
  active: z.boolean().default(false),
  createdAt: z.string().nullish(),
  /** Points the shop earns per sale, in place of a share of the price. */
  bonusPoints: z.number().default(0),
});
export type StoreLink = z.infer<typeof storeLinkSchema>;

/**
 * WalletSummaryResponse — the kiosk statement: what the link sold, and the reward
 * points those sales earned.
 *
 * Carries no payout balance, and must not: the kiosk price is collected for
 * HueVista's own service, so turning points into a bank transfer would make every
 * sale a collection on the shop's behalf. Points are spending power inside the
 * product, nothing more.
 */
export const walletSummarySchema = z.object({
  organizationId: z.string().nullish(),
  currency: z.string().default('INR'),
  pointsBalance: z.number().default(0),
  lifetimePointsEarned: z.number().default(0),
  pointsPerSale: z.number().default(0),
  kioskPricePaise: z.number().default(0),
  recentPayments: z
    .array(
      z.object({
        id: z.string(),
        amountPaise: z.number().default(0),
        bonusPoints: z.number().default(0),
        reversed: z.boolean().default(false),
        code: z.string().nullish(),
        createdAt: z.string().nullish(),
      }),
    )
    .default([]),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;
