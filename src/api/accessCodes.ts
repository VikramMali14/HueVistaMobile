import { apiFetch } from './client';
import { accessCodeResponseSchema, AccessCodeResponse } from './accountSchemas';

export const accessCodesApi = {
  /**
   * Redeem a retailer-issued access code (signed-in user). Links the account to
   * the issuing shop and sets the CUSTOMER role. Throws ApiError (404/400) for an
   * unknown, used or expired code.
   *
   * This is the only redeem the app has. `POST /access-codes/redeem-account` —
   * which provisioned a passwordless account off a printed code and returned a
   * session — is deliberately not wrapped: it made a six-character slip of paper
   * into an identity that could never be recovered or proven. A customer signs in
   * first (e-mail or Google), then brings their code to it.
   */
  redeem(code: string): Promise<AccessCodeResponse> {
    return apiFetch('/access-codes/redeem', { method: 'POST', json: { code: code.trim() } }).then((d) =>
      accessCodeResponseSchema.parse(d),
    );
  },
};
