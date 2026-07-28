import { z } from 'zod';

/**
 * Wire schemas for the image + project modules, mirrored from the backend DTOs
 * (`com.gridstore.huevista.image.dto` / `project.dto`). Verified against
 * `ImageController` and `ProjectController`.
 */

/** ImageResponse — POST /api/images/upload (201). */
export const imageResponseSchema = z.object({
  imageId: z.string(),
  imageUrl: z.string().nullish(),
  originalFilename: z.string().nullish(),
  imageType: z.string().nullish(), // INDOOR | OUTDOOR
  fileSize: z.number().nullish(),
  uploadedAt: z.string().nullish(),
});
export type ImageResponse = z.infer<typeof imageResponseSchema>;

/** Project lifecycle status. */
export const PROJECT_STATUSES = ['CREATED', 'SEGMENTING', 'SEGMENTED', 'FAILED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number] | (string & {});

/** RegionResponse — one segmented surface. */
export const regionSchema = z.object({
  id: z.number(),
  label: z.string().nullish(),
  category: z.string().nullish(), // RegionCategory enum (WALL, CEILING, …)
  /** Inline mask (base64/data URI) when present. */
  maskData: z.string().nullish(),
  /** URL to the mask PNG. Prefer the authed proxy GET /{id}/regions/{id}/mask. */
  maskUrl: z.string().nullish(),
  appliedShadeCode: z.string().nullish(),
  appliedHexCode: z.string().nullish(),
  displayOrder: z.number().nullish(),
  manual: z.boolean().default(false),
});
export type Region = z.infer<typeof regionSchema>;

/** ProjectResponse — full detail incl. regions. */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  roomType: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.string(),
  imageId: z.string().nullish(),
  imageUrl: z.string().nullish(),
  /** Prefer this as the canvas when present — masks align to the cleaned image. */
  cleanedImageUrl: z.string().nullish(),
  rawMaskUrl: z.string().nullish(),
  failureReason: z.string().nullish(),
  maskMode: z.string().nullish(),
  regions: z.array(regionSchema).default([]),
  hasShareLink: z.boolean().default(false),
  shareExpiresAt: z.string().nullish(),
  sharedBrands: z.array(z.string()).nullish(),
  sentToShopAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),

  // ─── Access ────────────────────────────────────────────────────────────────
  /**
   * Look-but-don't-touch: the colours last applied still render, but every write
   * is refused. The editor disables the palette on this rather than letting the
   * user paint and then fail on save.
   */
  readOnly: z.boolean().default(false),
  /** Why, in a sentence fit to show. Null when the project is fully open. */
  readOnlyReason: z.string().nullish(),
  /** When this project's paid validity runs out; null when it has no window. */
  accessExpiresAt: z.string().nullish(),
  /** What reopening a lapsed project costs, in paise. */
  reopenPricePaise: z.number().default(0),
});
export type Project = z.infer<typeof projectSchema>;

/** ShareResponse — POST /api/projects/{id}/share. */
export const shareResponseSchema = z.object({
  shareUrl: z.string(),
  shareToken: z.string().nullish(),
  expiresAt: z.string().nullish(),
});
export type ShareResponse = z.infer<typeof shareResponseSchema>;

/** ProjectSummaryResponse — list projection. */
export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  status: z.string(),
  imageId: z.string().nullish(),
  imageUrl: z.string().nullish(),
  /** Cleaned (AI photo clean-up) image, when one exists — the better thumbnail. */
  cleanedImageUrl: z.string().nullish(),
  regionCount: z.number().default(0),
  hasShareLink: z.boolean().default(false),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  /** "OWN" — the reader made it; "CUSTOMER" — made under a code their shop issued. */
  source: z.string().nullish(),
  customerName: z.string().nullish(),
  accessCode: z.string().nullish(),
  accessCodeId: z.string().nullish(),
  /** Lapsed subscription, or the room's own validity ran out. */
  readOnly: z.boolean().default(false),
  accessExpiresAt: z.string().nullish(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
