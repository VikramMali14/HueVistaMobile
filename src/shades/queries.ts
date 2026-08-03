import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { shadesApi, ShadeFilters } from '../api/shades';

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

export function usePopularShades(limit = 10) {
  return useQuery({
    queryKey: ['shades', 'popular', limit],
    queryFn: () => shadesApi.paged({ page: 0, size: limit }),
    select: (p) => p.content,
    staleTime: HOUR,
  });
}
