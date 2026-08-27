import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi, aiCreditsApi, authApi, billingApi, myRendersApi } from '../api';
import { useSession } from '../auth';
import { useShadeBrands } from '../shades/queries';

/**
 * The signed-in customer's own state.
 *
 * Keys live under 'account' / 'billing' (never 'shades'), so the offline
 * persister leaves them alone — none of this belongs on disk.
 */

const MINUTE = 60_000;

/**
 * Project allowance + access window, or null when no shop manages this account.
 * Only asked for a signed-in session; the endpoint is authed.
 */
export function useMyEntitlement() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['account', 'entitlement'],
    queryFn: () => accountApi.myEntitlement(),
    enabled: status === 'authenticated',
    staleTime: MINUTE,
  });
}

/**
 * The full profile — verification flags, phone, provider.
 *
 * The session carries a compact user (id, name, role); this is the rest, and it
 * is what tells a screen whether e-mail verification is still outstanding or
 * whether this account even has a password to change.
 */
export function useMyProfile() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['account', 'profile'],
    queryFn: () => authApi.profile(),
    enabled: status === 'authenticated',
    staleTime: 5 * MINUTE,
    retry: false,
  });
}

/** Companies and products the shop unlocked on this customer's code. */
export function useAssignedProducts() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['account', 'assigned-products'],
    queryFn: () => accountApi.assignedProducts(),
    enabled: status === 'authenticated',
    staleTime: 5 * MINUTE,
    retry: false,
  });
}

/**
 * The shop's shade-code pattern + whether it shows paint names. Every swatch in
 * the app reads through this, so it is cached long and fetched once.
 */
export function useShadeCodeScheme() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['account', 'shade-code-scheme'],
    queryFn: () => accountApi.myShadeCodeScheme(),
    enabled: status === 'authenticated',
    staleTime: 30 * MINUTE,
    retry: false,
  });
}

/**
 * The AI image wallet: spendable credits and what one costs today.
 *
 * `eligible: false` is a real answer, not an error — some accounts cannot hold
 * credits at all — so a screen reading this hides the top-up rather than
 * showing a price nobody could pay.
 */
export function useAiCredits() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['billing', 'ai-credits'],
    queryFn: () => aiCreditsApi.summary(),
    enabled: status === 'authenticated',
    staleTime: MINUTE,
    retry: false,
  });
}

/**
 * What one extra project costs with no plan behind you — the price a customer
 * buying for themselves actually pays, read off the free tier rather than held
 * as a constant that would quietly go wrong the day pricing moves.
 */
export function useProjectPrice() {
  const plans = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => billingApi.plans(),
    staleTime: 30 * MINUTE,
    retry: false,
  });
  return useMemo(() => {
    const free = plans.data?.find((p) => !p.purchasable) ?? plans.data?.[0];
    return {
      pricePaise: free?.extraProjectPriceWithTaxInPaise ?? 0,
      loading: plans.isLoading,
    };
  }, [plans.data, plans.isLoading]);
}

/** How many colour boards are left to download this month, and images per board. */
export function usePdfAllowance() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['billing', 'pdf-allowance'],
    queryFn: () => billingApi.pdfAllowance(),
    enabled: status === 'authenticated',
    staleTime: MINUTE,
    retry: false,
  });
}

/** Every finished AI image this account owns, whichever room it came from. */
export function useMyRenders() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['account', 'renders'],
    queryFn: () => myRendersApi.list(),
    enabled: status === 'authenticated',
    staleTime: MINUTE,
    retry: false,
  });
}

/**
 * Ask the shop for another project.
 *
 * Deliberately stays "sent" rather than resetting: a second identical mail helps
 * nobody, and the customer needs to see that the first one went.
 */
export function useRequestMoreProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.requestMoreProjects(),
    onSuccess: () => {
      // The shop may grant immediately; re-read the allowance next time it matters.
      queryClient.invalidateQueries({ queryKey: ['account', 'entitlement'] });
    },
  });
}

/**
 * The paint companies this account may actually work with.
 *
 * A customer's restriction comes from the code their shop issued — the brands it
 * unlocked. `restricted: false` means no limit, and `brands` is then the whole
 * catalogue and carries no meaning of its own.
 */
export function useAllowedBrands() {
  const allBrands = useShadeBrands();
  const assigned = useAssignedProducts();

  return useMemo(() => {
    const all = allBrands.data ?? [];
    const names = assigned.data?.allowedBrands ?? [];
    if (names.length === 0) return { restricted: false, brands: all, loading: allBrands.isLoading };
    const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
    return {
      restricted: true,
      brands: all.filter((b) => wanted.has(b.name.trim().toLowerCase())),
      loading: allBrands.isLoading || assigned.isLoading,
    };
  }, [allBrands.data, allBrands.isLoading, assigned.data, assigned.isLoading]);
}
