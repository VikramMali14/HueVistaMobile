import { apiFetch } from './client';
import {
  assignedProductsSchema,
  customerEntitlementSchema,
  shadeCodeSchemeSchema,
  AssignedProducts,
  CustomerEntitlement,
  ShadeCodeScheme,
} from './accountSchemas';

/**
 * The signed-in customer's own account state: what their shop assigned them, and
 * how that shop wants colours presented.
 *
 * Verified against `CustomerEntitlementController`, `AccessCodeController` and
 * `ShadeCodeSchemeController`.
 */
export const accountApi = {
  /**
   * Project allowance + access window. The backend answers 200 with an empty
   * body when the caller is not a shop-managed customer, so this resolves to
   * null rather than throwing — "nobody manages me" is a normal state.
   */
  async myEntitlement(): Promise<CustomerEntitlement | null> {
    const data = await apiFetch<unknown>('/me/entitlement');
    return data == null ? null : customerEntitlementSchema.parse(data);
  },

  /**
   * Ask the shop that onboarded this customer to add another project (202).
   *
   * This is what a shop-onboarded customer gets instead of a buy button: their
   * projects were assigned and paid for out of the shop's quota, and the shop
   * adds another in one click.
   */
  requestMoreProjects(): Promise<void> {
    return apiFetch('/me/request-more-projects', { method: 'POST' }).then(() => undefined);
  },

  /** Companies and individual products the shop unlocked on this customer's code. */
  assignedProducts(): Promise<AssignedProducts> {
    return apiFetch('/me/assigned-products').then((d) => assignedProductsSchema.parse(d));
  },

  /**
   * The shop's shade-code pattern and name-visibility choice. Resolves the shop
   * from whoever is asking; every part empty + names shown when there is none.
   */
  myShadeCodeScheme(): Promise<ShadeCodeScheme> {
    return apiFetch('/me/shade-code-scheme').then((d) => shadeCodeSchemeSchema.parse(d));
  },
};
