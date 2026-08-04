import { z } from 'zod';

/**
 * Wire schemas for the shared paint reference catalogue — the brands and the
 * product lines under them — plus the shop's own listings against those lines.
 *
 * Verified against `PaintCatalogueController` (`BrandResponse`, `LineResponse`)
 * and `ShopProductController` (`ShopProductResponse`). The product response
 * itself is already modelled as `shopProductSchema` in `accountSchemas`, because
 * a customer reads the same shape off their access code; nothing is duplicated
 * here.
 */

/** Whether a line is meant for inside or outside. `ProductCategory` on the wire. */
export const PRODUCT_CATEGORIES = ['INTERIOR', 'EXTERIOR'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** The quality band a line sits in. `QualityTier` on the wire. */
export const QUALITY_TIERS = ['ECONOMY', 'PREMIUM', 'LUXURY'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

/**
 * The backend's own default 1–10 score for a tier.
 *
 * Mirrors `QualityTier.defaultBrightness()`. Kept in step with it deliberately:
 * the shop may override the number, and if the two sides disagreed the slider
 * would jump the moment a listing was reloaded.
 */
export function defaultBrightness(tier: QualityTier): number {
  return tier === 'LUXURY' ? 10 : tier === 'PREMIUM' ? 8 : 4;
}

/** BrandResponse — a paint company in the shared catalogue. */
export const paintBrandSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().nullish(),
});
export type PaintBrand = z.infer<typeof paintBrandSchema>;

/** LineResponse — one product line under a brand, for interior or exterior. */
export const paintLineSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string().nullish(),
  qualityTier: z.string().nullish(),
  defaultFinish: z.string().nullish(),
});
export type PaintLine = z.infer<typeof paintLineSchema>;
