import { apiFetch } from './client';
import {
  myAccessSchema,
  networkReportSchema,
  orgSchema,
  retailerBrandOptionSchema,
  retailerFeatureOptionSchema,
  MyAccess,
  NetworkReport,
  Org,
  RetailerBrandOption,
  RetailerFeatureOption,
} from './orgSchemas';
import { z } from 'zod';

/**
 * The account's own organisation, and the downline it can see.
 *
 * Verified against `AccountController`, `HierarchyController`.
 */
export const orgApi = {
  /**
   * The org this account owns or belongs to. A customer or an unattached painter
   * has none, which the backend answers as an empty list — so this resolves to
   * null rather than throwing, because "I have no shop" is a normal state.
   */
  async mine(): Promise<Org | null> {
    const data = await apiFetch<unknown>('/organizations/mine');
    const list = z.array(orgSchema).safeParse(data);
    if (list.success) return list.data[0] ?? null;
    const single = orgSchema.safeParse(data);
    return single.success ? single.data : null;
  },

  /**
   * What this account's distributor has granted it: paint companies, and pages.
   *
   * Read once at sign-in so the tab bar can hide what the shop may not reach —
   * the app's mirror of the website's nav filter. Failing to load is treated by
   * every caller as "unrestricted", the same way the website treats it: a
   * backend hiccup must not strip a shop's tabs.
   */
  myAccess(): Promise<MyAccess> {
    return apiFetch('/hierarchy/my-access').then((d) => myAccessSchema.parse(d));
  },

  /** The downline this account can see, as a tree with per-node counts. */
  network(): Promise<NetworkReport> {
    return apiFetch('/hierarchy/network').then((d) => networkReportSchema.parse(d));
  },

  /** Every paint company, flagged with whether this shop has been granted it. */
  retailerBrands(retailerOrgId: string): Promise<RetailerBrandOption[]> {
    return apiFetch(`/hierarchy/retailers/${encodeURIComponent(retailerOrgId)}/brands`).then((d) =>
      z.array(retailerBrandOptionSchema).parse(d),
    );
  },

  /** Replace the shop's granted companies. An empty list means "no restriction". */
  setRetailerBrands(retailerOrgId: string, brandIds: number[]): Promise<RetailerBrandOption[]> {
    return apiFetch(`/hierarchy/retailers/${encodeURIComponent(retailerOrgId)}/brands`, {
      method: 'PUT',
      json: { brandIds },
    }).then((d) => z.array(retailerBrandOptionSchema).parse(d));
  },

  /** Every grantable page, flagged with whether this shop has it. */
  retailerFeatures(retailerOrgId: string): Promise<RetailerFeatureOption[]> {
    return apiFetch(`/hierarchy/retailers/${encodeURIComponent(retailerOrgId)}/features`).then((d) =>
      z.array(retailerFeatureOptionSchema).parse(d),
    );
  },

  /** Replace the shop's granted pages. An empty list means "no restriction". */
  setRetailerFeatures(retailerOrgId: string, features: string[]): Promise<RetailerFeatureOption[]> {
    return apiFetch(`/hierarchy/retailers/${encodeURIComponent(retailerOrgId)}/features`, {
      method: 'PUT',
      json: { features },
    }).then((d) => z.array(retailerFeatureOptionSchema).parse(d));
  },
};
