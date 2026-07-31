import { z } from 'zod';
import { apiFetch } from './client';

/**
 * Billing reads the app needs. Payment itself stays on the web: Checkout is a
 * Razorpay web flow, and the app has no payment SDK — so the app shows the real
 * price and hands the user to the site rather than inventing a purchase path.
 */

/**
 * ProjectPurchaseOptionsResponse — `GET /api/billing/points/project-options`.
 *
 * A project is bought on either of two rails: reward points (a shop currency,
 * earned at the kiosk or bought at ₹1 each) or money. The points price is the
 * cheaper one on every tier, and both fall with the buyer's plan — 80 points /
 * ₹99 with no plan, down to 40 / ₹45 on Business — so the price is always read
 * from here rather than held as a constant that would go quietly wrong for
 * every tier but one.
 *
 * **Retailers only.** Points are a shop's currency; a customer account gets 403
 * from this endpoint, which is why every caller treats a missing answer as
 * "nothing to offer" rather than as an error worth showing.
 */
export const projectPurchaseOptionsSchema = z.object({
  /** Whether a paid plan is currently covering this account — what sets the rate. */
  subscribed: z.boolean().default(false),
  /** The plan the price was read off; "FREE" when no paid plan covers the account. */
  pricingPlan: z.string().default('FREE'),
  /** What one project costs, in points. */
  projectPricePoints: z.number().default(0),
  /** What one project costs in money, in paise (GST included). */
  projectPricePaise: z.number().default(0),
  /** What another window on a lapsed project costs. Flat on both rails: a reopen
   *  buys more time on work already paid for once, so unlike a new project it
   *  does not get cheaper with the tier. */
  reopenPricePoints: z.number().default(0),
  reopenPricePaise: z.number().default(0),
  /** The account's spendable balance, so a caller can say whether it is enough. */
  pointsBalance: z.number().default(0),
  /** Days of access a purchase (or a reopen) opens. */
  validDays: z.number().default(0),
  /** Projects already paid for and not yet created. */
  availableCredits: z.number().default(0),
});
export type ProjectPurchaseOptions = z.infer<typeof projectPurchaseOptionsSchema>;

/**
 * SubscriptionResponse — `GET /api/billing/subscriptions/current`.
 *
 * One project covers the whole automatic pipeline, so there is a single quota
 * here where there used to be an image one and an auto-mask one. What a shop can
 * actually spend this cycle is the plan's own limit PLUS bought extras and any
 * credits carried over from a plan it upgraded away from — a bar that counted
 * only the limit read "full" while runs were still available.
 */
export const subscriptionSchema = z.object({
  id: z.string().nullish(),
  plan: z.string().nullish(),
  planDisplayName: z.string().nullish(),
  status: z.string().nullish(),
  currentPeriodStart: z.string().nullish(),
  currentPeriodEnd: z.string().nullish(),
  quantity: z.number().default(1),
  projectsUsed: z.number().default(0),
  projectsLimit: z.number().default(0),
  projectsRemaining: z.number().default(0),
  /** Projects held behind codes customers have not redeemed. Already paid for. */
  reservedProjects: z.number().default(0),
  /** Extras bought at the plan's rate. Never expire. */
  purchasedProjectCredits: z.number().default(0),
  /** Carried from a replaced plan — spendable now, gone when this cycle renews. */
  carriedProjectCredits: z.number().default(0),
  extraProjectPoints: z.number().default(0),
  extraProjectPricePaise: z.number().default(0),
  pdfDownloadsUsed: z.number().default(0),
  pdfDownloadsLimit: z.number().default(0),
  pdfDownloadsRemaining: z.number().default(0),
  pdfImageLimit: z.number().default(0),
  cancelAtPeriodEnd: z.boolean().default(false),
  trial: z.boolean().default(false),
  createdAt: z.string().nullish(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** RewardPointsSummaryResponse — `GET /api/billing/points`. Retailers only. */
export const rewardPointsSchema = z.object({
  balance: z.number().default(0),
  pointsPerSale: z.number().default(0),
  rupeesPerPoint: z.number().default(0),
  minPurchase: z.number().default(0),
  maxPurchase: z.number().default(0),
  validityDays: z.number().default(0),
  expiryWarningDays: z.number().default(0),
  /** The CALLER'S rate — it falls with their plan, so it is not a constant. */
  projectPrice: z.number().default(0),
  reopenPrice: z.number().default(0),
  nextExpiringPoints: z.number().nullish(),
  nextExpiryAt: z.string().nullish(),
  lots: z
    .array(z.object({ id: z.string(), pointsRemaining: z.number(), expiresAt: z.string() }))
    .default([]),
  recentActivity: z
    .array(
      z.object({
        id: z.string(),
        points: z.number(),
        type: z.string(),
        createdAt: z.string(),
      }),
    )
    .default([]),
});
export type RewardPoints = z.infer<typeof rewardPointsSchema>;

/** PdfAllowanceResponse — images per board and the monthly download quota. */
export const pdfAllowanceSchema = z.object({
  imagesPerPdf: z.number().default(0),
  monthlyLimit: z.number().default(0),
  used: z.number().default(0),
  remaining: z.number().default(0),
  unlimited: z.boolean().default(false),
});
export type PdfAllowance = z.infer<typeof pdfAllowanceSchema>;

export const billingApi = {
  projectPurchaseOptions(): Promise<ProjectPurchaseOptions> {
    return apiFetch('/billing/points/project-options').then((d) =>
      projectPurchaseOptionsSchema.parse(d),
    );
  },

  /**
   * The plan in force. The backend answers 404 when the account never had one,
   * which the client turns into an ApiError — callers treat that as "no plan"
   * rather than as a failure, because a customer legitimately has none.
   */
  currentSubscription(): Promise<Subscription> {
    return apiFetch('/billing/subscriptions/current').then((d) => subscriptionSchema.parse(d));
  },

  /** Balance, price list and expiry batches. Retailers only (403 otherwise). */
  rewardPoints(): Promise<RewardPoints> {
    return apiFetch('/billing/points').then((d) => rewardPointsSchema.parse(d));
  },

  /** Spend points on one extra project, at the caller's plan rate. */
  payProjectWithPoints(): Promise<ProjectPurchaseOptions> {
    return apiFetch('/billing/points/pay/project-credit', { method: 'POST' }).then((d) =>
      projectPurchaseOptionsSchema.parse(d),
    );
  },

  /** Spend points to give one project another validity window. */
  reopenProjectWithPoints(projectId: string): Promise<unknown> {
    return apiFetch(`/billing/points/pay/project-reopen/${encodeURIComponent(projectId)}`, {
      method: 'POST',
    });
  },

  /** Colour-board allowance, resolved against whichever plan pays for the caller. */
  pdfAllowance(): Promise<PdfAllowance> {
    return apiFetch('/billing/pdf-allowance').then((d) => pdfAllowanceSchema.parse(d));
  },
};

/** Paise → a rupee string for display, e.g. 5000 → "₹50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}

/** Points → a display string, e.g. 9 → "9 points". Singular reads badly as "1 points". */
export function formatPoints(points: number): string {
  return `${points} point${points === 1 ? '' : 's'}`;
}
