import { apiFetch } from './client';
import { accessCodeResponseSchema, AccessCodeResponse } from './accountSchemas';

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
};
