import { z } from 'zod';

/**
 * Wire schemas for the paint catalogue, mirrored from the backend
 * `com.gridstore.huevista.paint.dto`. All catalogue endpoints are public
 * (`@SecurityRequirements`) so they also serve guest mode.
 *
 * Note: `ShadeSummaryResponse` is annotated `@JsonInclude(NON_NULL)`, so most
 * fields are absent (not null) for the bulk brands — hence almost everything is
 * optional here. `hexCode` is what the swatch + recolor need; guard for its
 * absence at the call site.
 */

const numeric = z.union([z.number(), z.string()]).nullish(); // BigDecimal (lrv) may arrive as number or string

/** LIST projection — `GET /api/shades`, `/paged`, `/{brand}`. */
export const shadeSummarySchema = z.object({
  brandName: z.string().nullish(),
  brandSlug: z.string().nullish(),
  shadeCode: z.string(),
  name: z.string().nullish(),
  hexCode: z.string().nullish(),
  shadeFamily: z.string().nullish(),
  featureTag: z.string().nullish(),
  popularity: z.number().nullish(),
  colorTemperature: z.string().nullish(),
  tonality: z.string().nullish(),
  lrv: numeric,
  rgbR: z.number().nullish(),
  rgbG: z.number().nullish(),
  rgbB: z.number().nullish(),
  finishRecommendations: z.array(z.string()).nullish(),
});
export type ShadeSummary = z.infer<typeof shadeSummarySchema>;

/** DETAIL projection — `GET /api/shades/{brand}/{code}` (adds AI-enriched prose). */
export const shadeDetailSchema = shadeSummarySchema.extend({
  id: z.number().nullish(),
  pageUrl: z.string().nullish(),
  suitableRooms: z.array(z.string()).nullish(),
  styleTags: z.array(z.string()).nullish(),
  moodDescriptors: z.array(z.string()).nullish(),
  aiDescription: z.string().nullish(),
});
export type ShadeDetail = z.infer<typeof shadeDetailSchema>;

/** `GET /api/shades/brands`. */
export const brandSummarySchema = z.object({
  name: z.string(),
  slug: z.string(),
  shadeCount: z.number(),
});
export type BrandSummary = z.infer<typeof brandSummarySchema>;

/** `GET /api/shades/paged`. */
export const pagedShadesSchema = z.object({
  content: z.array(shadeSummarySchema),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
});
export type PagedShades = z.infer<typeof pagedShadesSchema>;
