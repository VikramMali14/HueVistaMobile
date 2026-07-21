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

export function useShadesInfinite(filters: ShadeFilters) {
  return useInfiniteQuery({
    queryKey: ['shades', 'paged', filters],
    queryFn: ({ pageParam }) => shadesApi.paged({ ...filters, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    staleTime: HOUR / 2,
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

export function usePopularShades(limit = 10) {
  return useQuery({
    queryKey: ['shades', 'popular', limit],
    queryFn: () => shadesApi.paged({ page: 0, size: limit }),
    select: (p) => p.content,
    staleTime: HOUR,
  });
}
