export { API_ORIGIN, API_BASE, resolveImageUrl } from './config';
export { apiFetch, setAuthHooks } from './client';
export type { RequestOptions, AuthHooks } from './client';
export { ApiError, userMessage } from './errors';
export { authApi } from './auth';
export type { LoginBody, RegisterBody } from './auth';
export * from './schemas';
export { shadesApi } from './shades';
export type { ShadeFilters } from './shades';
export { imagesApi } from './images';
export type { LocalImage } from './images';
export { projectsApi, regionMaskUrl } from './projects';
export type { RegionColorUpdate, CreateProjectInput } from './projects';
export {
  imageResponseSchema,
  projectSchema,
  projectSummarySchema,
  regionSchema,
  PROJECT_STATUSES,
} from './projectSchemas';
export type { ImageResponse, Project, ProjectSummary, Region, ProjectStatus } from './projectSchemas';
export {
  shadeSummarySchema,
  shadeDetailSchema,
  brandSummarySchema,
  pagedShadesSchema,
} from './shadeSchemas';
export type { ShadeSummary, ShadeDetail, BrandSummary, PagedShades } from './shadeSchemas';
