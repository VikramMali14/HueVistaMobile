import { z } from 'zod';
import { apiFetch } from './client';
import {
  paintJobSchema,
  painterInvitationSchema,
  painterProfileSchema,
  painterRetailerLinkSchema,
  PaintJob,
  PainterInvitation,
  PainterProfile,
  PainterRetailerLink,
} from './painterSchemas';

/**
 * Painters and the jobs they work.
 *
 * Verified against `PainterController`, `PainterInvitationController` and
 * `PaintJobController`.
 */
export const painterApi = {
  /** This painter's own profile — service areas, specialities, day rate. */
  me(): Promise<PainterProfile> {
    return apiFetch('/painters/me').then((d) => painterProfileSchema.parse(d));
  },

  updateMe(body: {
    phone?: string;
    serviceAreas?: string[];
    specialties?: string[];
    yearsExperience?: number;
    dayRateInr?: number;
    active?: boolean;
  }): Promise<PainterProfile> {
    return apiFetch('/painters/me', { method: 'PUT', json: body }).then((d) =>
      painterProfileSchema.parse(d),
    );
  },

  /** The shops this painter is linked to. */
  myRetailers(): Promise<PainterRetailerLink[]> {
    return apiFetch('/painters/me/retailers').then((d) =>
      z.array(painterRetailerLinkSchema).parse(d),
    );
  },

  /** The painters working with one shop (the shop's own view). */
  forRetailer(retailerOrgId: string): Promise<PainterProfile[]> {
    return apiFetch(`/painters/by-retailer/${encodeURIComponent(retailerOrgId)}`).then((d) =>
      z.array(painterProfileSchema).parse(d),
    );
  },

  /** Unlink a painter from the shop. */
  removeFromRetailer(retailerOrgId: string, painterUserId: string): Promise<void> {
    return apiFetch(
      `/painters/by-retailer/${encodeURIComponent(retailerOrgId)}/${encodeURIComponent(painterUserId)}`,
      { method: 'DELETE' },
    ).then(() => undefined);
  },

  // ─── Invitations ──────────────────────────────────────────────────────────

  /** Shop side: mint an invitation code to hand a painter. */
  invite(retailerOrgId: string, phone?: string): Promise<PainterInvitation> {
    return apiFetch(`/organizations/${encodeURIComponent(retailerOrgId)}/painter-invitations`, {
      method: 'POST',
      json: phone ? { phone } : {},
    }).then((d) => painterInvitationSchema.parse(d));
  },

  /** Shop side: the invitations issued, so an unused one can be re-sent. */
  listInvitations(retailerOrgId: string): Promise<PainterInvitation[]> {
    return apiFetch(`/organizations/${encodeURIComponent(retailerOrgId)}/painter-invitations`).then(
      (d) => z.array(painterInvitationSchema).parse(d),
    );
  },

  /** Painter side: redeem an invitation, which links the account to that shop. */
  redeemInvitation(code: string): Promise<PainterRetailerLink> {
    return apiFetch('/painter-invitations/redeem', {
      method: 'POST',
      json: { code: code.trim() },
    }).then((d) => painterRetailerLinkSchema.parse(d));
  },
};

/**
 * Paint jobs — the work itself.
 *
 * A job carries the approved shades, the litres, the site address and the quote,
 * and moves PENDING → ACCEPTED → IN_PROGRESS → COMPLETED (or DECLINED/CANCELLED).
 * Each transition is its own endpoint rather than a status field the client sets,
 * so the backend keeps the rules about which move is legal from where.
 */
export const jobsApi = {
  minePainter(page = 0, size = 200): Promise<PaintJob[]> {
    return apiFetch(`/jobs/mine/painter?page=${page}&size=${size}`).then((d) =>
      z.array(paintJobSchema).parse(d),
    );
  },

  mineCustomer(page = 0, size = 200): Promise<PaintJob[]> {
    return apiFetch(`/jobs/mine/customer?page=${page}&size=${size}`).then((d) =>
      z.array(paintJobSchema).parse(d),
    );
  },

  byRetailer(retailerOrgId: string, page = 0, size = 200): Promise<PaintJob[]> {
    return apiFetch(
      `/jobs/by-retailer/${encodeURIComponent(retailerOrgId)}?page=${page}&size=${size}`,
    ).then((d) => z.array(paintJobSchema).parse(d));
  },

  get(jobId: string): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}`).then((d) => paintJobSchema.parse(d));
  },

  accept(jobId: string, body: { scheduledFor?: string; notes?: string } = {}): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}/accept`, { method: 'POST', json: body }).then(
      (d) => paintJobSchema.parse(d),
    );
  },

  decline(jobId: string, reason: string): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}/decline`, {
      method: 'POST',
      json: { reason },
    }).then((d) => paintJobSchema.parse(d));
  },

  start(jobId: string): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST' }).then((d) =>
      paintJobSchema.parse(d),
    );
  },

  complete(jobId: string): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}/complete`, { method: 'POST' }).then((d) =>
      paintJobSchema.parse(d),
    );
  },

  cancel(jobId: string, reason?: string): Promise<PaintJob> {
    return apiFetch(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      json: reason ? { reason } : {},
    }).then((d) => paintJobSchema.parse(d));
  },
};
