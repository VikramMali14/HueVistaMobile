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
export {
  billingApi,
  projectPurchaseOptionsSchema,
  subscriptionSchema,
  rewardPointsSchema,
  pdfAllowanceSchema,
  formatPaise,
  formatPoints,
} from './billing';
export type {
  ProjectPurchaseOptions,
  Subscription,
  RewardPoints,
  PdfAllowance,
} from './billing';
export { orgApi } from './org';
export {
  orgSchema,
  myAccessSchema,
  networkNodeSchema,
  networkReportSchema,
  retailerBrandOptionSchema,
  retailerFeatureOptionSchema,
} from './orgSchemas';
export type {
  Org,
  OrgType,
  MyAccess,
  NetworkNode,
  NetworkReport,
  RetailerBrandOption,
  RetailerFeatureOption,
} from './orgSchemas';
export { adminApi } from './admin';
export {
  adminStatsSchema,
  adminRevenueSchema,
  adminAiUsageSchema,
  adminUserSchema,
} from './adminSchemas';
export type { AdminStats, AdminRevenue, AdminAiUsage, AdminUser } from './adminSchemas';
export { retailApi } from './retail';
export type { ComboShadeInput, CreateComboInput } from './retail';
export { catalogueApi, productsApi } from './products';
export type { ShopProductInput } from './products';
export {
  paintBrandSchema,
  paintLineSchema,
  defaultBrightness,
  PRODUCT_CATEGORIES,
  QUALITY_TIERS,
} from './catalogueSchemas';
export type { PaintBrand, PaintLine, ProductCategory, QualityTier } from './catalogueSchemas';
export {
  shopAccessCodeSchema,
  projectGrantSchema,
  retailerComboSchema,
  storeLinkSchema,
  walletSummarySchema,
} from './retailSchemas';
export type {
  ShopAccessCode,
  ProjectGrant,
  RetailerCombo,
  StoreLink,
  WalletSummary,
} from './retailSchemas';
export { painterApi, jobsApi } from './painter';
export {
  paintJobSchema,
  painterProfileSchema,
  painterRetailerLinkSchema,
  painterInvitationSchema,
  PAINT_JOB_STATUSES,
  decimal,
} from './painterSchemas';
export type {
  PaintJob,
  PaintJobStatus,
  PainterProfile,
  PainterRetailerLink,
  PainterInvitation,
} from './painterSchemas';
export { supportApi } from './support';
export type { SupportConversation, SupportConversationSummary, SupportMessage } from './support';
export {
  accessCodeResponseSchema,
  redeemAccountResponseSchema,
  customerEntitlementSchema,
  assignedProductsSchema,
  shadeCodeSchemeSchema,
  retiredShadeCodeSchemeSchema,
  shopProductSchema,
} from './accountSchemas';
export type {
  AccessCodeResponse,
  RedeemAccountResponse,
  CustomerEntitlement,
  AssignedProducts,
  ShadeCodeScheme,
  RetiredShadeCodeScheme,
  ShopProduct,
} from './accountSchemas';
export {
  shadeSummarySchema,
  shadeDetailSchema,
  brandSummarySchema,
  pagedShadesSchema,
} from './shadeSchemas';
export type { ShadeSummary, ShadeDetail, BrandSummary, PagedShades } from './shadeSchemas';
