import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi, authApi, billingApi, shadesApi } from '../api';
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
  const { status, role } = useSession();
  return useQuery({
    queryKey: ['account', 'assigned-products'],
    queryFn: () => accountApi.assignedProducts(),
    // Only a redeemed customer has an issuing shop to ask about.
    enabled: status === 'authenticated' && role === 'CUSTOMER',
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

/** What buying (or reopening) a project costs this account today. */
export function useProjectPurchaseOptions() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['billing', 'project-purchase-options'],
    queryFn: () => billingApi.projectPurchaseOptions(),
    enabled: status === 'authenticated',
    staleTime: 5 * MINUTE,
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
 * A customer's restriction comes from the code their shop issued (the brands it
 * unlocked); a retailer's comes from their distributor's grant. Both end up as
 * the same answer here so the catalogue has one question to ask.
 *
 * `restricted: false` means no limit — `brands` is then the whole catalogue and
 * carries no meaning of its own.
 */
export function useAllowedBrands() {
  const { role } = useSession();
  const allBrands = useShadeBrands();
  const assigned = useAssignedProducts();
  const isCustomer = role === 'CUSTOMER';

  const myBrands = useQuery({
    queryKey: ['account', 'my-brands'],
    // Retailers (and painters/distributors) read the distributor's grant.
    queryFn: () => shadesApi.myBrands(),
    enabled: role != null && !isCustomer,
    staleTime: 30 * MINUTE,
    retry: false,
  });

  return useMemo(() => {
    const all = allBrands.data ?? [];
    if (isCustomer) {
      const names = assigned.data?.allowedBrands ?? [];
      if (names.length === 0) return { restricted: false, brands: all, loading: allBrands.isLoading };
      const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
      return {
        restricted: true,
        brands: all.filter((b) => wanted.has(b.name.trim().toLowerCase())),
        loading: allBrands.isLoading || assigned.isLoading,
      };
    }
    const mine = myBrands.data;
    // The shop-scoped endpoint returns everything when unrestricted, so a shorter
    // list than the catalogue is what marks a real restriction.
    if (!mine || mine.length === all.length) {
      return { restricted: false, brands: all, loading: allBrands.isLoading || myBrands.isLoading };
    }
    return { restricted: true, brands: mine, loading: false };
  }, [allBrands.data, allBrands.isLoading, assigned.data, assigned.isLoading, isCustomer, myBrands.data, myBrands.isLoading]);
}
