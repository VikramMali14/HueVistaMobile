import { apiFetch } from './client';
import { z } from 'zod';
import {
  brandSummarySchema,
  pagedShadesSchema,
  shadeDetailSchema,
  shadeSummarySchema,
  BrandSummary,
  PagedShades,
  ShadeDetail,
  ShadeSummary,
} from './shadeSchemas';

/** Server-side filters shared by the list/paged endpoints. */
export interface ShadeFilters {
  /** Brand slug, e.g. "asian-paints". */
  brand?: string;
  /** Shade family, e.g. "off whites". */
  family?: string;
  /** cool / warm / neutral. */
  temperature?: string;
  /** light / medium / dark. */
  tonality?: string;
  /** Matches name (partial) or exact shade code. */
  search?: string;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}`.length > 0) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const brandListSchema = z.array(brandSummarySchema);
const summaryListSchema = z.array(shadeSummarySchema);
const familyListSchema = z.array(z.string());
const detailListSchema = z.array(shadeDetailSchema);

/** Paint catalogue client. Every call is public — no auth header needed. */
export const shadesApi = {
  /** Companies that have shades, with counts — drives the brand picker. */
  brands(): Promise<BrandSummary[]> {
    return apiFetch('/shades/brands', { skipAuth: true }).then((d) => brandListSchema.parse(d));
  },

  /** One page of the catalogue (default size 500, max 1000 server-side). */
  paged(filters: ShadeFilters & { page?: number; size?: number }): Promise<PagedShades> {
    const { page = 0, size = 120, ...f } = filters;
    return apiFetch(`/shades/paged${queryString({ ...f, page, size })}`, { skipAuth: true }).then((d) =>
      pagedShadesSchema.parse(d),
    );
  },

  /** Distinct family names for a brand — drives the family filter chips. */
  families(brandSlug: string): Promise<string[]> {
    return apiFetch(`/shades/${encodeURIComponent(brandSlug)}/families`, { skipAuth: true }).then((d) =>
      familyListSchema.parse(d),
    );
  },

  /** Full detail for one shade (AI-enriched prose, suitable rooms, etc.). */
  detail(brandSlug: string, code: string): Promise<ShadeDetail> {
    return apiFetch(`/shades/${encodeURIComponent(brandSlug)}/${encodeURIComponent(code)}`, {
      skipAuth: true,
    }).then((d) => shadeDetailSchema.parse(d));
  },

  /** Nearest catalogue shades to any hex color (CIELAB ΔE), closest first. */
  match(hex: string, opts: { brand?: string; limit?: number } = {}): Promise<ShadeDetail[]> {
    const h = hex.replace('#', '');
    return apiFetch(`/shades/match${queryString({ hex: h, brand: opts.brand, limit: opts.limit })}`, {
      skipAuth: true,
    }).then((d) => detailListSchema.parse(d));
  },

  /** Unpaged list (use `paged` for the grid; this is handy for small filtered sets). */
  list(filters: ShadeFilters): Promise<ShadeSummary[]> {
    return apiFetch(`/shades${queryString({ ...filters })}`, { skipAuth: true }).then((d) =>
      summaryListSchema.parse(d),
    );
  },

  // The shop-scoped twins (`/shades/mine`, `/shades/mine/brands`) are not here.
  // They apply the DISTRIBUTOR's brand grant, which is a retailer's restriction
  // and not a customer's: a customer's companies come from the access code
  // their shop issued, which `useAllowedBrands` reads off `/me/assigned-products`.
  // Two endpoints with no caller are two endpoints someone will wire up by
  // mistake — they are one `git log` away if a shop-side screen ever returns.
};
