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

export const billingApi = {
  projectPurchaseOptions(): Promise<ProjectPurchaseOptions> {
    return apiFetch('/billing/points/project-options').then((d) =>
      projectPurchaseOptionsSchema.parse(d),
    );
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
