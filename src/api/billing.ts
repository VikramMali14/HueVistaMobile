import { z } from 'zod';
import { apiFetch } from './client';

/**
 * Billing reads the app needs. Payment itself stays on the web: Checkout is a
 * Razorpay web flow, and the app has no payment SDK — so the app shows the real
 * price and hands the user to the site rather than inventing a purchase path.
 */

/**
 * ProjectPurchaseOptionsResponse — `GET /api/billing/project-credit/options`.
 * Both prices come back, not just today's, so a lapsing plan can be priced
 * honestly before it lapses.
 */
export const projectPurchaseOptionsSchema = z.object({
  subscribed: z.boolean().default(false),
  /** What one more project costs right now, in paise. */
  projectPricePaise: z.number().default(0),
  subscribedProjectPricePaise: z.number().default(0),
  unsubscribedProjectPricePaise: z.number().default(0),
  /** What another window on a lapsed project costs, in paise. */
  reopenPricePaise: z.number().default(0),
  /** Days of access a purchase (or a reopen) opens. */
  validDays: z.number().default(0),
  currency: z.string().default('INR'),
  /** Projects already paid for and not yet created. */
  availableCredits: z.number().default(0),
});
export type ProjectPurchaseOptions = z.infer<typeof projectPurchaseOptionsSchema>;

export const billingApi = {
  projectPurchaseOptions(): Promise<ProjectPurchaseOptions> {
    return apiFetch('/billing/project-credit/options').then((d) =>
      projectPurchaseOptionsSchema.parse(d),
    );
  },
};

/** Paise → a rupee string for display, e.g. 5000 → "₹50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}
