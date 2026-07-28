import { apiFetch } from './client';
import {
  accessCodeResponseSchema,
  redeemAccountResponseSchema,
  AccessCodeResponse,
  RedeemAccountResponse,
} from './accountSchemas';

export const accessCodesApi = {
  /**
   * Redeem a retailer-issued access code (signed-in user). Links the account to
   * the issuing shop and sets the CUSTOMER role. Throws ApiError (404/400) for an
   * unknown, used or expired code.
   */
  redeem(code: string): Promise<AccessCodeResponse> {
    return apiFetch('/access-codes/redeem', { method: 'POST', json: { code: code.trim() } }).then((d) =>
      accessCodeResponseSchema.parse(d),
    );
  },

  /**
   * Redeem with no account at all. The backend provisions a passwordless
   * CUSTOMER account in the name the shop entered and returns a full session, so
   * a walk-in goes from a code on a slip to a signed-in app in one step — no
   * sign-up form, and no password to invent at the counter.
   */
  redeemAccount(code: string): Promise<RedeemAccountResponse> {
    return apiFetch('/access-codes/redeem-account', {
      method: 'POST',
      json: { code: code.trim() },
      skipAuth: true,
    }).then((d) => redeemAccountResponseSchema.parse(d));
  },
};
