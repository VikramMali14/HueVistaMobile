import { z } from 'zod';

/**
 * Wire schemas for the super-admin endpoints, mirrored from `AdminController`
 * (`com.gridstore.huevista.admin`). Every route below it is `@PreAuthorize
 * hasRole('ADMIN')`, so any other role gets 403 — the queries are gated on the
 * session role rather than retried.
 *
 * The stats endpoints answer with `Map.of(...)` rather than a DTO, so each key
 * carries a default here: a map that gains or loses a key server-side should
 * cost the dashboard one tile, not the whole screen.
 */

/** GET /api/admin/stats — platform health summary. */
export const adminStatsSchema = z.object({
  totalUsers: z.number().default(0),
  newUsersLast30Days: z.number().default(0),
  totalOrganizations: z.number().default(0),
  totalSubscriptions: z.number().default(0),
  activeSubscriptions: z.number().default(0),
  totalProjects: z.number().default(0),
  segmentedProjects: z.number().default(0),
  failedProjects: z.number().default(0),
  totalProjectsUsed: z.number().default(0),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

/**
 * GET /api/admin/stats/revenue — active subscriptions and estimated monthly
 * revenue, both broken down by plan display name. Rupees, not paise: this
 * endpoint divides by 100 server-side.
 */
export const adminRevenueSchema = z.object({
  activeSubscriptionsByPlan: z.record(z.string(), z.number()).default({}),
  monthlyRevenueByPlanInRupees: z.record(z.string(), z.number()).default({}),
  totalEstimatedMonthlyRevenueInRupees: z.number().default(0),
});
export type AdminRevenue = z.infer<typeof adminRevenueSchema>;

/** GET /api/admin/stats/ai-usage — project spend across active subscriptions. */
export const adminAiUsageSchema = z.object({
  totalProjectsUsedThisCycle: z.number().default(0),
  activeSubscriptions: z.number().default(0),
  avgProjectsPerActiveSubscription: z.number().default(0),
});
export type AdminAiUsage = z.infer<typeof adminAiUsageSchema>;

/** AdminUserResponse — GET /api/admin/users and /users/recent. */
export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  role: z.string(),
  provider: z.string().nullish(),
  emailVerified: z.boolean().default(false),
  createdAt: z.string().nullish(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;
