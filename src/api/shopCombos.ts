import { z } from 'zod';
import { apiFetch } from './client';

/**
 * The palettes the customer's own shop put together, read from the studio.
 *
 * `GET /api/me/retailer-combos` resolves the shop from whoever is asking, so a
 * customer who redeemed that shop's code gets its card and a stranger gets an
 * empty list. It is the only piece of the retailer surface a customer touches —
 * the rest of that API left with the counter screens — so it lives here rather
 * than in a retail module the customer app no longer has.
 */

/** One colour in a shop's saved palette. */
export const comboShadeSchema = z.object({
  code: z.string().nullish(),
  name: z.string().nullish(),
  hex: z.string().nullish(),
});
export type ComboShade = z.infer<typeof comboShadeSchema>;

/** `scope` picks which photo it leads: INTERIOR for a room, EXTERIOR for a building. */
export const shopComboSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  organizationName: z.string().nullish(),
  name: z.string().nullish(),
  scope: z.string().nullish(),
  shades: z.array(comboShadeSchema).default([]),
  createdAt: z.string().nullish(),
});
export type ShopCombo = z.infer<typeof shopComboSchema>;

export const shopCombosApi = {
  /** What this customer's shop wants offered in the studio. Empty for a stranger. */
  mine(): Promise<ShopCombo[]> {
    return apiFetch('/me/retailer-combos').then((d) => z.array(shopComboSchema).parse(d));
  },
};
