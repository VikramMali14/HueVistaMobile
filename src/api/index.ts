/**
 * The customer app's whole wire surface.
 *
 * Everything the counter, the network and the admin console used to reach for
 * has gone with those screens — the app ships one role now, and an export here
 * is a promise that some customer screen has a use for it.
 */
export { API_ORIGIN, API_BASE, WEB_ORIGIN, resolveImageUrl, isApiOriginUrl, webUrl } from './config';
export { apiFetch, setAuthHooks } from './client';
export type { RequestOptions, AuthHooks } from './client';
export { ApiError, userMessage, hasCode, API_CODES } from './errors';
export type { ApiCode } from './errors';
export { authApi, verificationApi } from './auth';
export type { LoginBody, RegisterBody } from './auth';
export * from './schemas';
export { shadesApi } from './shades';
export type { ShadeFilters } from './shades';
export { imagesApi } from './images';
export type { LocalImage } from './images';
export { projectsApi, regionMaskUrl } from './projects';
export type { RegionColorUpdate, CreateProjectInput, CustomMaskInput, RegionCategory } from './projects';
export {
  imageResponseSchema,
  projectSchema,
  projectSummarySchema,
  regionSchema,
  shareResponseSchema,
  PROJECT_STATUSES,
} from './projectSchemas';
export type { ImageResponse, Project, ProjectSummary, Region, ProjectStatus, ShareResponse } from './projectSchemas';
export { recommendationsApi } from './recommendations';
export { recommendationResponseSchema } from './recommendationSchemas';
export type { RecommendationResponse, ColorCombo, MatchedShade } from './recommendationSchemas';
export { accessCodesApi } from './accessCodes';
export { accountApi } from './account';
export { billingApi, formatPaise, planSchema, pdfAllowanceSchema } from './billing';
export type { Plan, PdfAllowance } from './billing';
export { boardsApi, RENDER_STATUSES } from './boards';
export type {
  BoardShade,
  BoardPageInput,
  ProjectCombo,
  ColourBoardResult,
  ProjectRender,
  RenderStatus,
  CreateRenderInput,
  TimeOfDay,
  BorderMode,
  Lighting,
  Furnishing,
  RenderStyle,
  RenderQuality,
  SourceImage,
} from './boards';
export { aiCreditsApi, myRendersApi } from './aiCredits';
export type { AiCreditSummary, MyRender, RenderableProject } from './aiCredits';
export { shopCombosApi } from './shopCombos';
export type { ShopCombo, ComboShade } from './shopCombos';
export { catalogueApi } from './products';
export { paintBrandSchema, paintLineSchema, defaultBrightness } from './catalogueSchemas';
export type { PaintBrand, PaintLine } from './catalogueSchemas';
export { supportApi } from './support';
export type { SupportConversation, SupportConversationSummary, SupportMessage } from './support';
export {
  accessCodeResponseSchema,
  redeemAccountResponseSchema,
  customerEntitlementSchema,
  assignedProductsSchema,
  shadeCodeSchemeSchema,
  shopProductSchema,
} from './accountSchemas';
export type {
  AccessCodeResponse,
  RedeemAccountResponse,
  CustomerEntitlement,
  AssignedProducts,
  ShadeCodeScheme,
  ShopProduct,
} from './accountSchemas';
export {
  shadeSummarySchema,
  shadeDetailSchema,
  brandSummarySchema,
  pagedShadesSchema,
} from './shadeSchemas';
export type { ShadeSummary, ShadeDetail, BrandSummary, PagedShades } from './shadeSchemas';
