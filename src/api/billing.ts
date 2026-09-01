import { z } from 'zod';
import { apiFetch } from './client';

/**
 * What a customer's money buys, and what it has already bought.
 *
 * Every price here is quoted from the server; nothing in this file names a
 * number the backend did not say. Buying now finishes in the app — the order is
 * created here, Razorpay Checkout runs in a browser session, and the outcome is
 * verified here (see `src/api/checkout.ts`). What the app still does not carry
 * is a payment SDK, which is why the sheet itself is a web page.
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

/**
 * A Razorpay order the backend has just created, ready to be opened.
 *
 * `amount` is authoritative and derived server-side from the caller's own plan —
 * the app never names a price, and the screen that shows one shows this.
 */
export const razorpayOrderSchema = z.object({
  orderId: z.string(),
  amount: z.number(),
  currency: z.string().default('INR'),
  razorpayKeyId: z.string(),
  /** The tier it was priced at — "FREE" when no paid plan covers the account. */
  pricingPlan: z.string().nullish(),
});
export type RazorpayOrder = z.infer<typeof razorpayOrderSchema>;

/** What Razorpay hands back on a successful sheet, sent on for verification. */
export interface VerifyPayment {
  orderId: string;
  paymentId: string;
  signature: string;
}

export const billingApi = {
  /** Every tier, with what an extra project costs on each. Public. */
  plans(): Promise<Plan[]> {
    return apiFetch('/billing/plans').then((d) => z.array(planSchema).parse(d));
  },

  /** Colour-board allowance for whoever is asking. */
  pdfAllowance(): Promise<PdfAllowance> {
    return apiFetch('/billing/pdf-allowance').then((d) => pdfAllowanceSchema.parse(d));
  },

  /**
   * Open an order for one more room, at whatever the caller's own plan charges.
   * The count is the only thing sent; the price comes back.
   */
  createProjectOrder(credits = 1): Promise<RazorpayOrder> {
    return apiFetch(`/billing/projects/order?credits=${encodeURIComponent(credits)}`, {
      method: 'POST',
    }).then((d) => razorpayOrderSchema.parse(d));
  },

  /**
   * Hand the signed result back. The backend re-checks the signature against its
   * own record of the order before it grants anything, and refuses a replay, so
   * one payment buys exactly one room however many times this is called.
   */
  verifyProjectPurchase(payment: VerifyPayment): Promise<void> {
    return apiFetch('/billing/projects/verify', { method: 'POST', json: payment }).then(() => undefined);
  },
};

/** Paise → a rupee string for display, e.g. 5000 → "₹50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}
