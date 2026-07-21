import { apiFetch } from './client';
import { API_BASE } from './config';
import { z } from 'zod';
import {
  projectSchema,
  projectSummarySchema,
  shareResponseSchema,
  Project,
  ProjectSummary,
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

  /** Kick off async SAM 2 segmentation. AUTO consumes an auto-mask credit (402
   *  AUTO_MASK_UNAVAILABLE when the plan has none); MANUAL is free. */
  segment(id: string, maskMode: 'AUTO' | 'MANUAL' = 'AUTO'): Promise<Project> {
    return apiFetch(`/projects/${encodeURIComponent(id)}/segment`, {
      method: 'POST',
      json: { maskMode },
    }).then((d) => projectSchema.parse(d));
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

  /** Create a time-limited public share link. days ∈ {3,7,14} (default 7);
   *  brands = comma-separated companies the viewer may repaint with (blank = all). */
  share(id: string, opts: { days?: 3 | 7 | 14; brands?: string } = {}): Promise<ShareResponse> {
    const params = new URLSearchParams({ days: String(opts.days ?? 7) });
    if (opts.brands) params.set('brands', opts.brands);
    return apiFetch(`/projects/${encodeURIComponent(id)}/share?${params.toString()}`, { method: 'POST' }).then((d) =>
      shareResponseSchema.parse(d),
    );
  },
};

/** Absolute authed URL for a region's mask PNG (fetch with the access token). */
export function regionMaskUrl(projectId: string, regionId: number): string {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/regions/${regionId}/mask`;
}
