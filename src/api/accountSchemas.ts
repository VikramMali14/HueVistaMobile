import { z } from 'zod';

/**
 * AccessCodeResponse — from `com.gridstore.huevista.account.dto`, verified
 * against `AccessCodeController`. Returned when a signed-in user redeems a
 * retailer-issued code (links them to that shop).
 */
export const accessCodeResponseSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  organizationId: z.string().nullish(),
  organizationName: z.string().nullish(),
  validDays: z.number().nullish(),
  expiresAt: z.string().nullish(),
  used: z.boolean().nullish(),
  expired: z.boolean().nullish(),
  usedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  allowedBrands: z.array(z.string()).nullish(),
});
export type AccessCodeResponse = z.infer<typeof accessCodeResponseSchema>;
