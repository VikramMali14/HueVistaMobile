import { z } from 'zod';
import { apiFetch } from './client';
import { boardShadeSchema } from './boards';
import { razorpayOrderSchema, type RazorpayOrder, type VerifyPayment } from './billing';

/**
 * The AI image wallet, and the shelf of images it has paid for.
 *
 * One credit is one image and credits never expire. A customer holds them
 * because a project their shop gave them includes no image of its own — this is
 * the only way to get one — so the balance is read straight from the wallet
 * rather than inferred from the project.
 */

export const aiCreditSummarySchema = z.object({
  balance: z.number().default(0),
  /** False for an account that cannot hold credits at all — hide the top-up. */
  eligible: z.boolean().default(false),
  /** What one credit costs today, in paise, with the launch discount applied. */
  pricePaise: z.number().default(0),
  listPricePaise: z.number().default(0),
  discountPercent: z.number().default(0),
  minPurchase: z.number().default(0),
  maxPurchase: z.number().default(0),
  /** Credits one image costs at the default quality. */
  renderCost: z.number().default(1),
  renderTiers: z
    .array(z.object({ quality: z.string(), credits: z.number().default(1) }))
    .default([]),
  currency: z.string().default('INR'),
});
export type AiCreditSummary = z.infer<typeof aiCreditSummarySchema>;

/** One finished image on the account's shelf, whichever room it came from. */
export const myRenderSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string().nullish(),
  roomType: z.string().nullish(),
  status: z.string(),
  imageUrl: z.string().nullish(),
  timeOfDay: z.string().nullish(),
  lighting: z.string().nullish(),
  furnishing: z.string().nullish(),
  style: z.string().nullish(),
  quality: z.string().nullish(),
  note: z.string().nullish(),
  comboId: z.string().nullish(),
  comboTitle: z.string().nullish(),
  boardIndex: z.number().nullish(),
  /** Empty when the board page was deleted — the image still stands on its own. */
  shades: z.array(boardShadeSchema).default([]),
  createdAt: z.string().nullish(),
  completedAt: z.string().nullish(),
});
export type MyRender = z.infer<typeof myRenderSchema>;

/** A closed room that still has combinations an image could be made from. */
export const renderableProjectSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  roomType: z.string().nullish(),
  imageUrl: z.string().nullish(),
  cleanedImageUrl: z.string().nullish(),
  closedAt: z.string().nullish(),
  comboCount: z.number().default(0),
});
export type RenderableProject = z.infer<typeof renderableProjectSchema>;

export const aiCreditsApi = {
  /** Balance, today's price and what an image costs. */
  summary(): Promise<AiCreditSummary> {
    return apiFetch('/billing/ai-credits').then((d) => aiCreditSummarySchema.parse(d));
  },

  /**
   * Open an order for `credits` images. Only the count is sent — the amount is
   * derived server-side at today's price and discount, so a stale price on
   * screen cannot become a stale price charged.
   */
  createOrder(credits: number): Promise<RazorpayOrder> {
    return apiFetch('/billing/ai-credits/order', {
      method: 'POST',
      json: { credits },
    }).then((d) => razorpayOrderSchema.parse(d));
  },

  /** Hand the signed result back; returns the refreshed wallet. Replay-safe. */
  verifyPurchase(payment: VerifyPayment): Promise<AiCreditSummary> {
    return apiFetch('/billing/ai-credits/verify', { method: 'POST', json: payment }).then((d) =>
      aiCreditSummarySchema.parse(d),
    );
  },
};

export const myRendersApi = {
  /** Every finished image this account owns, newest first. */
  list(): Promise<MyRender[]> {
    return apiFetch('/me/renders').then((d) => z.array(myRenderSchema).parse(d));
  },

  /** Rooms that still have a combination worth rendering. */
  renderableProjects(): Promise<RenderableProject[]> {
    return apiFetch('/me/renderable-projects').then((d) =>
      z.array(renderableProjectSchema).parse(d),
    );
  },
};
