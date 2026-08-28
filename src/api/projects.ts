import { apiFetch } from './client';
import { API_BASE } from './config';
import { z } from 'zod';
import {
  projectSchema,
  projectSummarySchema,
  regionSchema,
  shareResponseSchema,
  Project,
  ProjectSummary,
  Region,
  ShareResponse,
} from './projectSchemas';

const summaryListSchema = z.array(projectSummarySchema);

/** One region's colour to autosave (PUT /regions). null clears the colour. */
export interface RegionColorUpdate {
  regionId: number;
  shadeCode?: string | null;
  hexCode?: string | null;
}

export interface CreateProjectInput {
  imageId: string;
  name?: string;
  roomType?: string;
  notes?: string;
}

/**
 * What the backend calls a region's category. MANUAL is the catch-all.
 *
 * Left open the way `ProjectStatus` is, because the server owns this enum and
 * already sends values that were not listed here — CEILING among them, which
 * the room summary has always grouped and this union has always rejected.
 * Anything unrecognised travels through untouched rather than being forced
 * into one of the names the phone happens to know.
 */
export type RegionCategory =
  | 'MAIN_WALL'
  | 'ACCENT_WALL'
  | 'OTHER_WALL'
  | 'CEILING'
  | 'TRIM'
  | 'MANUAL'
  | (string & {});

/** A mask the user drew by hand, ready to save as a region. */
export interface CustomMaskInput {
  /** Base64 PNG (bare or as a data URL): opaque = paint here, black = leave it. */
  maskBase64: string;
  category?: RegionCategory;
  label?: string;
}

export const projectsApi = {
  create(input: CreateProjectInput): Promise<Project> {
    return apiFetch('/projects', { method: 'POST', json: input }).then((d) => projectSchema.parse(d));
  },

  list(page = 0, size = 200): Promise<ProjectSummary[]> {
    return apiFetch(`/projects?page=${page}&size=${size}`).then((d) => summaryListSchema.parse(d));
  },

  get(id: string): Promise<Project> {
    return apiFetch(`/projects/${encodeURIComponent(id)}`).then((d) => projectSchema.parse(d));
  },

  /** Poll target after /segment; same shape as get(). */
  status(id: string): Promise<Project> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/status`).then((d) => projectSchema.parse(d));
  },

  /** Kick off async SAM 2 segmentation. Neither mode costs anything here: the
   *  project's credit was taken when the project was created, so this run — and
   *  any retry of it — is already paid for. AUTO detects walls with AI, MANUAL
   *  stops after the clean-up so they can be marked by hand. */
  segment(id: string, maskMode: 'AUTO' | 'MANUAL' = 'AUTO'): Promise<Project> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/segment`, {
      method: 'POST',
      json: { maskMode },
    }).then((d) => projectSchema.parse(d));
  },

  /**
   * Mark one wall by hand: SAM 2 segments the surface under a tap, at normalized
   * (0–1) coordinates, and returns it as a new region.
   *
   * Covered by the project's own credit like every other step inside it, so a
   * customer can mark as many walls as the room has without a second charge.
   */
  segmentPoint(id: string, x: number, y: number, label?: string): Promise<Region> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/segment/point`, {
      method: 'POST',
      json: { x, y, label },
      // Point segmentation is a synchronous model call; the default 20 s can be tight.
      timeoutMs: 60_000,
    }).then((d) => regionSchema.parse(d));
  },

  /**
   * Save a wall the user outlined with a finger, as a region.
   *
   * No model call and no credit: the client sends the finished mask. That makes
   * this the way through whenever AI detection is unavailable, out of credit or
   * simply wrong about a wall — on the phone that used to be a dead end, since
   * every wall had to come from SAM 2.
   */
  createCustomMaskRegion(id: string, input: CustomMaskInput): Promise<Region> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/regions/custom-mask`, {
      method: 'POST',
      json: input,
      // A 1600px PNG over a phone connection; the default 20 s is tight.
      timeoutMs: 60_000,
    }).then((d) => regionSchema.parse(d));
  },

  /**
   * Replace an existing region's mask with a hand-refined one. Allowed for
   * AI-detected regions too — this is how a mask the model got wrong (half a
   * pillar, an edge that overshoots) is fixed without a second AI call.
   */
  updateRegionMask(id: string, regionId: number, input: CustomMaskInput): Promise<Region> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/regions/${regionId}/mask`, {
      method: 'PUT',
      json: input,
      timeoutMs: 60_000,
    }).then((d) => regionSchema.parse(d));
  },

  /** Delete a hand-marked wall. AI-detected regions are protected (400). */
  deleteRegion(id: string, regionId: number): Promise<void> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/regions/${regionId}`, {
      method: 'DELETE',
    }).then(() => undefined);
  },

  /** Partial update of name / room type / notes. */
  update(id: string, patch: { name?: string; roomType?: string; notes?: string }): Promise<Project> {
    return apiFetch(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch }).then((d) =>
      projectSchema.parse(d),
    );
  },

  /** Per-swatch autosave of region colours. Returns 204 (no body). */
  updateRegionColors(id: string, updates: RegionColorUpdate[]): Promise<void> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/regions`, {
      method: 'PUT',
      json: updates,
    }).then(() => undefined);
  },

  remove(id: string): Promise<void> {
    return apiFetch(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined);
  },

  /**
   * Create a time-limited public share link. days ∈ {3,7,10} — a share link hands
   * its holder the same repaint capability a walk-in access code does, so it is
   * capped at the same 10 days rather than the old 14.
   *
   * `brands` = comma-separated companies the viewer may repaint with (blank = all).
   */
  share(id: string, opts: { days?: 3 | 7 | 10; brands?: string } = {}): Promise<ShareResponse> {
    const params = new URLSearchParams({ days: String(opts.days ?? 10) });
    if (opts.brands) params.set('brands', opts.brands);
    return apiFetch(`/projects/${encodeURIComponent(id)}/share?${params.toString()}`, { method: 'POST' }).then((d) =>
      shareResponseSchema.parse(d),
    );
  },

  /**
   * Withdraw the public link. The URL already sent out answers 404 from here on;
   * sharing again mints a new token rather than reviving the old one.
   *
   * Worth having on its own button because sharing is the one action in the app
   * that hands a stranger the ability to repaint the room — the person who sent
   * it needs a way to take that back without deleting the project.
   */
  revokeShare(id: string): Promise<void> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/share`, { method: 'DELETE' }).then(
      () => undefined,
    );
  },
};

/** Absolute authed URL for a region's mask PNG (fetch with the access token). */
export function regionMaskUrl(projectId: string, regionId: number): string {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/regions/${regionId}/mask`;
}
