import { z } from 'zod';
import { apiFetch } from './client';

/**
 * What a customer's money buys, and what it has already bought.
 *
 * Payment itself stays on the web: Checkout is a Razorpay web flow and the app
 * carries no payment SDK, so every price here is quoted from the server and the
 * purchase hands off to the site rather than inventing a path the app cannot
 * finish. Nothing here quotes a number the backend did not say.
 *
 * The points rail left with the counter screens — points are a shop's currency
 * and a customer holds none, so quoting a price they would be refused at was
 * worse than not quoting one.
 */

/** One tier from `GET /api/billing/plans`. */
export const planSchema = z.object({
  plan: z.string(),
  displayName: z.string().nullish(),
  purchasable: z.boolean().default(false),
  rank: z.number().default(0),
  /** What one extra project costs on this tier, GST included. */
  extraProjectPriceWithTaxInPaise: z.number().default(0),
  extraProjectPriceInPaise: z.number().default(0),
  /** Colour matching (the Finder) is off on the free tier. */
  colorMatching: z.boolean().default(false),
});
export type Plan = z.infer<typeof planSchema>;

/**
 * PdfAllowanceResponse — how many colour boards are left to download this month,
 * and how many images each may carry. Resolved against whichever plan pays for
 * the caller, which for a shop-managed customer is their shop's.
 */
export const pdfAllowanceSchema = z.object({
  imagesPerPdf: z.number().default(0),
  monthlyLimit: z.number().default(0),
  used: z.number().default(0),
  remaining: z.number().default(0),
  /**
   * An allowance with no ceiling. The server sends `Integer.MAX_VALUE` for both
   * counts in that case and this flag to say what it means — which is exactly
   * why the flag has to be read: printed raw, the account screen offered
   * "2147483647 of 2147483647 downloads left this month".
   */
  unlimited: z.boolean().default(false),
});
export type PdfAllowance = z.infer<typeof pdfAllowanceSchema>;

export const billingApi = {
  /** Every tier, with what an extra project costs on each. Public. */
  plans(): Promise<Plan[]> {
    return apiFetch('/billing/plans').then((d) => z.array(planSchema).parse(d));
  },

  /** Colour-board allowance for whoever is asking. */
  pdfAllowance(): Promise<PdfAllowance> {
    return apiFetch('/billing/pdf-allowance').then((d) => pdfAllowanceSchema.parse(d));
  },
};

/** Paise → a rupee string for display, e.g. 5000 → "₹50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}
