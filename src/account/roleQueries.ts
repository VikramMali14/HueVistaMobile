import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, jobsApi, orgApi, painterApi, retailApi } from '../api';
import { useSession } from '../auth';

/**
 * Server state for the non-customer roles.
 *
 * Everything here is keyed off the account's own organisation, which most calls
 * need as a path segment — so `useMyOrg` is the gate: its answer enables the
 * rest, and a role with no org simply never fires them.
 *
 * Keys live under 'org' / 'retail' / 'painter' / 'billing', never 'shades', so
 * the offline persister (which only keeps the catalogue) leaves them alone.
 */

const MINUTE = 60_000;

/** The org this account owns. Null for a customer or an unlinked painter. */
export function useMyOrg() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['org', 'mine'],
    queryFn: () => orgApi.mine(),
    enabled: status === 'authenticated' && role !== 'CUSTOMER',
    staleTime: 30 * MINUTE,
    retry: false,
  });
}

/**
 * The distributor's grant to this shop — companies and pages.
 *
 * Failing to load resolves to null, which every caller reads as "unrestricted".
 * That matches the website: a backend hiccup must not strip a shop's own tabs.
 */
export function useMyAccess() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['org', 'my-access'],
    queryFn: () => orgApi.myAccess(),
    enabled: status === 'authenticated' && role !== 'CUSTOMER',
    staleTime: 30 * MINUTE,
    retry: false,
  });
}

/** The downline tree: retailers under a distributor, painters under a shop. */
export function useNetwork() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['org', 'network'],
    queryFn: () => orgApi.network(),
    enabled: status === 'authenticated' && (role === 'DISTRIBUTOR' || role === 'RETAILER'),
    staleTime: 5 * MINUTE,
  });
}

/** The plan in force. 404 when the account never had one — not retried. */
export function useSubscription() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => billingApi.currentSubscription(),
    enabled: status === 'authenticated' && role !== 'CUSTOMER',
    staleTime: MINUTE,
    retry: false,
  });
}

/** Reward-point balance and price list. Retailers only — 403 for anyone else. */
export function useRewardPoints() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['billing', 'points'],
    queryFn: () => billingApi.rewardPoints(),
    enabled: status === 'authenticated' && role === 'RETAILER',
    staleTime: MINUTE,
    retry: false,
  });
}

// ─── Retailer counter ───────────────────────────────────────────────────────

export function useAccessCodes(orgId?: string | null) {
  return useQuery({
    queryKey: ['retail', 'codes', orgId],
    queryFn: () => retailApi.listCodes(orgId as string),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

export function useShopCustomers(orgId?: string | null) {
  return useQuery({
    queryKey: ['retail', 'customers', orgId],
    queryFn: () => retailApi.listCustomers(orgId as string),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

/**
 * Every code mutation lands back on the same list, so they share one
 * invalidation. The subscription goes with them: issuing a code reserves
 * projects from the shop's allowance and revoking one hands them back, so the
 * quota on the counter dashboard is stale the moment a code changes.
 */
function useCodeMutation<TArgs, TResult>(
  orgId: string | null | undefined,
  fn: (orgId: string, args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(orgId as string, args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'codes', orgId] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

export function useCreateCode(orgId?: string | null) {
  return useCodeMutation(orgId, (id: string, a: { customerName: string; projectQuota: number }) =>
    retailApi.createCode(id, a.customerName, a.projectQuota),
  );
}

export function useRevokeCode(orgId?: string | null) {
  return useCodeMutation(orgId, (id: string, codeId: string) => retailApi.revokeCode(id, codeId));
}

export function useExtendCode(orgId?: string | null) {
  return useCodeMutation(orgId, (id: string, codeId: string) => retailApi.extendCode(id, codeId));
}

export function useTopUpCode(orgId?: string | null) {
  return useCodeMutation(orgId, (id: string, a: { codeId: string; projects: number }) =>
    retailApi.grantCodeProjects(id, a.codeId, a.projects),
  );
}

/** Add a project to one customer's allowance, out of the shop's own. */
export function useGrantProject(orgId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => retailApi.grantProject(orgId as string, customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'customers', orgId] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

/**
 * Buy one extra project with points.
 *
 * A balance debit, not a checkout — the money was paid when the points were
 * bought or earned — so it either succeeds or 402s with the backend's own "earn
 * more or buy points" message. That is why this one purchase lives in the app
 * while subscribing and buying points stay on the web behind Razorpay.
 */
export function useBuyProjectWithPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.payProjectWithPoints(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'points'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'project-purchase-options'] });
    },
  });
}

// ─── Painter ────────────────────────────────────────────────────────────────

export function usePainterJobs() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['painter', 'jobs'],
    queryFn: () => jobsApi.minePainter(),
    enabled: status === 'authenticated' && role === 'PAINTER',
    staleTime: 30_000,
  });
}

export function usePainterProfile() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['painter', 'me'],
    queryFn: () => painterApi.me(),
    enabled: status === 'authenticated' && role === 'PAINTER',
    staleTime: 5 * MINUTE,
    retry: false,
  });
}

export function usePainterRetailers() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['painter', 'retailers'],
    queryFn: () => painterApi.myRetailers(),
    enabled: status === 'authenticated' && role === 'PAINTER',
    staleTime: 5 * MINUTE,
    retry: false,
  });
}

/**
 * One job transition. Each is its own endpoint on the backend, so the caller
 * names the move rather than setting a status — the rules about which move is
 * legal from where stay on the server.
 */
export function useJobAction(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: { type: 'accept' | 'start' | 'complete' | 'decline'; reason?: string }) => {
      switch (action.type) {
        case 'accept':
          return jobsApi.accept(jobId);
        case 'start':
          return jobsApi.start(jobId);
        case 'complete':
          return jobsApi.complete(jobId);
        case 'decline':
          return jobsApi.decline(jobId, action.reason ?? 'Not available');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['painter', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['painter', 'job', jobId] });
    },
  });
}

export function useJob(jobId?: string | null) {
  return useQuery({
    queryKey: ['painter', 'job', jobId],
    queryFn: () => jobsApi.get(jobId as string),
    enabled: Boolean(jobId),
  });
}

/** The customer's own side of the same jobs — what their shop has scheduled. */
export function useMyJobsAsCustomer() {
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['jobs', 'mine-customer'],
    queryFn: () => jobsApi.mineCustomer(),
    enabled: status === 'authenticated' && role === 'CUSTOMER',
    staleTime: MINUTE,
    retry: false,
  });
}
