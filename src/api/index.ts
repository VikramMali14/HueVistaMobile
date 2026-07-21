export { API_ORIGIN, API_BASE } from './config';
export { apiFetch, setAuthHooks } from './client';
export type { RequestOptions, AuthHooks } from './client';
export { ApiError, userMessage } from './errors';
export { authApi } from './auth';
export type { LoginBody, RegisterBody } from './auth';
export * from './schemas';
export { shadesApi } from './shades';
export type { ShadeFilters } from './shades';
export {
  shadeSummarySchema,
  shadeDetailSchema,
  brandSummarySchema,
  pagedShadesSchema,
} from './shadeSchemas';
export type { ShadeSummary, ShadeDetail, BrandSummary, PagedShades } from './shadeSchemas';
