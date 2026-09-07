import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { shadesApi, ShadeFilters } from '../api/shades';
import { measuredLrv } from './colorScience';

/**
 * React Query hooks for the paint catalogue. All keys start with 'shades' so the
 * offline persister (src/query/persist.ts) caches them to disk and nothing else.
 */

const HOUR = 1000 * 60 * 60;
const PAGE_SIZE = 120;

export function useShadeBrands() {
  return useQuery({ queryKey: ['shades', 'brands'], queryFn: () => shadesApi.brands(), staleTime: HOUR });
}

export function useShadeFamilies(brandSlug?: string) {
  return useQuery({
    queryKey: ['shades', 'families', brandSlug ?? null],
    queryFn: () => shadesApi.families(brandSlug as string),
    enabled: !!brandSlug,
    staleTime: HOUR,
  });
}

/**
 * `enabled: false` holds the request until there is something worth asking for
 * — the catalogue picks a company first, and firing an unfiltered page while
 * that choice is still open would pull shades from every company on the
 * platform and cache them under a key nothing will read again.
 */
export function useShadesInfinite(filters: ShadeFilters, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ['shades', 'paged', filters],
    queryFn: ({ pageParam }) => shadesApi.paged({ ...filters, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    staleTime: HOUR / 2,
    enabled: options.enabled ?? true,
  });
}

export function useShadeDetail(brandSlug?: string, code?: string) {
  return useQuery({
    queryKey: ['shades', 'detail', brandSlug ?? null, code ?? null],
    queryFn: () => shadesApi.detail(brandSlug as string, code as string),
    enabled: !!brandSlug && !!code,
    staleTime: HOUR,
  });
}

/**
 * A handful of shades from one company, for the colour strip on its card in the
 * company picker.
 *
 * A company is a name and a number until you can see what it actually sells, so
 * the picker shows six of its colours. One small request per company, cached for
 * an hour alongside everything else in the catalogue — and there are only ever a
 * few companies, because a shop is set up for the ones it stocks.
 */
export function useBrandPreview(brandSlug?: string, count = 6) {
  return useQuery({
    queryKey: ['shades', 'preview', brandSlug ?? null, count],
    queryFn: () => shadesApi.paged({ brand: brandSlug, page: 0, size: count }),
    select: (p) => p.content.filter((s) => !!s.hexCode),
    enabled: !!brandSlug,
    staleTime: HOUR,
  });
}

/**
 * The catalogue shades nearest a colour, closest first (CIELAB ΔE, server-side).
 *
 * This is the colour finder's whole answer: a customer points at a colour in
 * their own photo and gets shades they can actually buy. Scoped to a company
 * when the shop only stocks one — the nearest match overall is no use if it is
 * from a brand nobody behind the counter can sell.
 */
export function useShadeMatch(hex: string | null, brandSlug?: string, limit = 8) {
  return useQuery({
    queryKey: ['shades', 'match', hex, brandSlug ?? null, limit],
    queryFn: () => shadesApi.match(hex as string, { brand: brandSlug, limit }),
    enabled: !!hex,
    staleTime: HOUR,
  });
}

export function usePopularShades(limit = 10) {
  return useQuery({
    queryKey: ['shades', 'popular', limit],
    queryFn: () => shadesApi.paged({ page: 0, size: limit }),
    select: (p) => p.content,
    staleTime: HOUR,
  });
}

/**
 * The measured LRV behind each of a set of shade codes.
 *
 * A room the customer opens tomorrow knows which shade is on each wall — the
 * backend stores the code and the hex — but not how much light that paint
 * actually reflects, and the LRV is what the renderer corrects the hex against
 * (see `paintTarget`). Without this, a reopened room painted its walls a
 * measurably different colour from the one the customer had just chosen and
 * saved, which is the worst version of the bug: the app disagreeing with itself.
 *
 * One small request per distinct code, cached for an hour under the `shades` key
 * like everything else in the catalogue, so it is served from disk offline and a
 * room with three walls in one shade asks once.
 */
export function useShadeLrvs(codes: readonly string[]): Record<string, number | null> {
  const unique = Array.from(new Set(codes.filter((c) => c.trim().length > 0))).sort();
  const results = useQueries({
    queries: unique.map((code) => ({
      queryKey: ['shades', 'lrv', code],
      queryFn: () => shadesApi.list({ search: code }),
      // The search is a partial name match as well as an exact code match, so
      // take the row whose code IS the one asked for and ignore the rest.
      select: (rows: Awaited<ReturnType<typeof shadesApi.list>>) =>
        measuredLrv(rows.find((r) => r.shadeCode === code) ?? {}),
      staleTime: HOUR,
    })),
  });

  const out: Record<string, number | null> = {};
  unique.forEach((code, i) => {
    out[code] = results[i]?.data ?? null;
  });
  return out;
}
