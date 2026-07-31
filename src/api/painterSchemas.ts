import { z } from 'zod';

/**
 * Wire schemas for the painter module — `com.gridstore.huevista.painter.dto`.
 *
 * A painter is linked to one or more retailer shops by redeeming an invitation;
 * the shops then assign them jobs carrying the approved shades, the site address
 * and the quote.
 */

/** Backend `PaintJobStatus`. */
export const PAINT_JOB_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PaintJobStatus = (typeof PAINT_JOB_STATUSES)[number];
/** Tolerant of a status this build has not heard of, so one new enum value on the
 *  backend cannot blank a painter's whole job list. */
export const paintJobStatusSchema = z.string();

/**
 * PaintJobResponse. Money and areas are BigDecimal on the wire, which Jackson may
 * render as a number or a string depending on configuration — both are accepted
 * and normalised by the caller rather than guessed at here.
 */
export const paintJobSchema = z.object({
  id: z.string(),
  projectId: z.string().nullish(),
  projectName: z.string().nullish(),
  retailerId: z.string().nullish(),
  retailerName: z.string().nullish(),
  customerId: z.string().nullish(),
  customerName: z.string().nullish(),
  painterId: z.string().nullish(),
  painterName: z.string().nullish(),
  status: paintJobStatusSchema,
  siteAddress: z.string().nullish(),
  estimatedAreaSqft: z.union([z.number(), z.string()]).nullish(),
  estimatedPaintLiters: z.union([z.number(), z.string()]).nullish(),
  quotedAmountInr: z.union([z.number(), z.string()]).nullish(),
  estimatedDays: z.number().nullish(),
  scheduledFor: z.string().nullish(),
  startedAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  notes: z.string().nullish(),
  declineReason: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type PaintJob = z.infer<typeof paintJobSchema>;

/** PainterProfileResponse — `GET /api/painters/me`. */
export const painterProfileSchema = z.object({
  userId: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  serviceAreas: z.array(z.string()).default([]),
  specialties: z.array(z.string()).default([]),
  yearsExperience: z.number().nullish(),
  dayRateInr: z.union([z.number(), z.string()]).nullish(),
  rating: z.union([z.number(), z.string()]).nullish(),
  jobsCompleted: z.number().nullish(),
  active: z.boolean().default(true),
  createdAt: z.string().nullish(),
});
export type PainterProfile = z.infer<typeof painterProfileSchema>;

/** PainterRetailerLinkResponse — one shop a painter works with. */
export const painterRetailerLinkSchema = z.object({
  id: z.string(),
  painterId: z.string().nullish(),
  painterName: z.string().nullish(),
  retailerId: z.string().nullish(),
  retailerName: z.string().nullish(),
  status: z.string().nullish(),
  commissionPct: z.union([z.number(), z.string()]).nullish(),
  acceptedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type PainterRetailerLink = z.infer<typeof painterRetailerLinkSchema>;

/** PainterInvitationResponse — the code a shop hands a painter. */
export const painterInvitationSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  retailerId: z.string().nullish(),
  retailerName: z.string().nullish(),
  phoneHint: z.string().nullish(),
  expiresAt: z.string().nullish(),
  used: z.boolean().default(false),
  expired: z.boolean().default(false),
  usedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type PainterInvitation = z.infer<typeof painterInvitationSchema>;

/** A BigDecimal that may arrive as a number or a string → a number, or null. */
export function decimal(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
