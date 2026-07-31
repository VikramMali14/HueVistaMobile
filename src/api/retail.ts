import { z } from 'zod';
import { apiFetch } from './client';
import { customerEntitlementSchema, CustomerEntitlement } from './accountSchemas';
import {
  projectGrantSchema,
  retailerComboSchema,
  shopAccessCodeSchema,
  storeLinkSchema,
  walletSummarySchema,
  ProjectGrant,
  RetailerCombo,
  ShopAccessCode,
  StoreLink,
  WalletSummary,
} from './retailSchemas';

/**
 * The counter: the codes a shop issues, the customers holding them, and the
 * projects it grants them.
 *
 * Verified against `AccessCodeController`, `CustomerEntitlementController`,
 * `RetailerComboController`, `StoreLinkController` and `WalletController`.
 */
export const retailApi = {
  // ─── Access codes ─────────────────────────────────────────────────────────

  /** Every code this shop has issued, newest first. */
  listCodes(orgId: string): Promise<ShopAccessCode[]> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/access-codes`).then((d) =>
      z.array(shopAccessCodeSchema).parse(d),
    );
  },

  /**
   * Issue a code for a walk-in.
   *
   * `projectQuota` reserves that many projects from the shop's own monthly
   * allowance at the moment the code is created — so the shop meets its ceiling
   * here, at the counter, rather than when the customer is already waiting with a
   * photo. The backend refuses with 402 when the allowance cannot cover it.
   */
  createCode(orgId: string, customerName: string, projectQuota: number): Promise<ShopAccessCode> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/access-codes`, {
      method: 'POST',
      json: { customerName: customerName.trim(), projectQuota },
    }).then((d) => shopAccessCodeSchema.parse(d));
  },

  /** Correct a code that has not been redeemed yet (name, quota). */
  updateCode(
    orgId: string,
    codeId: string,
    body: { customerName: string; projectQuota: number },
  ): Promise<ShopAccessCode> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/access-codes/${encodeURIComponent(codeId)}`,
      { method: 'PUT', json: { ...body, customerName: body.customerName.trim() } },
    ).then((d) => shopAccessCodeSchema.parse(d));
  },

  /** Withdraw a code. Reserved projects go back to the shop's allowance. */
  revokeCode(orgId: string, codeId: string): Promise<ShopAccessCode> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/access-codes/${encodeURIComponent(codeId)}`,
      { method: 'DELETE' },
    ).then((d) => shopAccessCodeSchema.parse(d));
  },

  /** Add projects to a code already in a customer's hands. */
  grantCodeProjects(orgId: string, codeId: string, projects = 1): Promise<ShopAccessCode> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/access-codes/${encodeURIComponent(codeId)}/projects`,
      { method: 'POST', json: { projects } },
    ).then((d) => shopAccessCodeSchema.parse(d));
  },

  /**
   * Give a code another validity window.
   *
   * Extending never SHORTENS the window — a code with time left keeps it and the
   * new days are added on, which is the whole point of the button.
   */
  extendCode(orgId: string, codeId: string): Promise<ShopAccessCode> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/access-codes/${encodeURIComponent(codeId)}/extend`,
      { method: 'POST' },
    ).then((d) => shopAccessCodeSchema.parse(d));
  },

  // ─── Customers ────────────────────────────────────────────────────────────

  /**
   * The customers this shop is responsible for: the ones it manages now, plus
   * anyone still holding a code it issued. Both belong to the shop — a customer
   * who later redeemed a second shop's code used to vanish from the first shop's
   * list along with the projects it had paid for.
   */
  listCustomers(orgId: string): Promise<CustomerEntitlement[]> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/customers`).then((d) =>
      z.array(customerEntitlementSchema).parse(d),
    );
  },

  /** Add a project to one customer's allowance, out of the shop's own. */
  grantProject(orgId: string, customerId: string, projects = 1): Promise<CustomerEntitlement> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/customers/${encodeURIComponent(customerId)}/grant-project`,
      { method: 'POST', json: { projects } },
    ).then((d) => customerEntitlementSchema.parse(d));
  },

  /** Every grant this shop has made, so an unspent one can be taken back. */
  listGrants(orgId: string): Promise<ProjectGrant[]> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/project-grants`).then((d) =>
      z.array(projectGrantSchema).parse(d),
    );
  },

  /** Take back a granted project the customer has not spent. */
  revokeGrant(orgId: string, grantId: string): Promise<void> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/project-grants/${encodeURIComponent(grantId)}`,
      { method: 'DELETE' },
    ).then(() => undefined);
  },

  // ─── Shop palettes, kiosk link, points statement ──────────────────────────

  /** The shop's own saved palettes, as the studio offers them. */
  myCombos(): Promise<RetailerCombo[]> {
    return apiFetch('/me/retailer-combos').then((d) => z.array(retailerComboSchema).parse(d));
  },

  /** The shop's public kiosk links. */
  storeLinks(orgId: string): Promise<StoreLink[]> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/store-links`).then((d) =>
      z.array(storeLinkSchema).parse(d),
    );
  },

  /** What the kiosk sold, and the points it earned. */
  wallet(orgId: string): Promise<WalletSummary> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/wallet`).then((d) =>
      walletSummarySchema.parse(d),
    );
  },
};
