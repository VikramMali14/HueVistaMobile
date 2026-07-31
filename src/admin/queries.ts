import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api';
import { useSession } from '../auth';

/**
 * Platform state, for an admin.
 *
 * Every endpoint behind these is `hasRole('ADMIN')`, so they are gated on the
 * session role rather than fired and allowed to 403 — and not retried, because
 * a refused call will be refused again.
 *
 * Keys live under 'admin', never 'shades', so the offline persister (which only
 * keeps the catalogue) never writes platform figures to the device.
 */

const MINUTE = 60_000;

function useAdminQuery<T>(key: string, fn: () => Promise<T>, staleMinutes = 2) {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['admin', key],
    queryFn: fn,
    enabled: status === 'authenticated' && role === 'ADMIN',
    staleTime: staleMinutes * MINUTE,
    retry: false,
  });
}

/** Users, shops, subscriptions and projects, counted. */
export function useAdminStats() {
  return useAdminQuery('stats', () => adminApi.stats());
}

/** Active subscriptions and estimated monthly revenue, per plan. */
export function useAdminRevenue() {
  return useAdminQuery('revenue', () => adminApi.revenue(), 5);
}

/** Project spend across the active subscriptions. */
export function useAdminAiUsage() {
  return useAdminQuery('ai-usage', () => adminApi.aiUsage(), 5);
}

/** The ten newest accounts. */
export function useAdminRecentUsers() {
  return useAdminQuery('recent-users', () => adminApi.recentUsers());
}
