import { z } from 'zod';
import { apiFetch } from './client';
import {
  adminAiUsageSchema,
  adminRevenueSchema,
  adminStatsSchema,
  adminUserSchema,
  AdminAiUsage,
  AdminRevenue,
  AdminStats,
  AdminUser,
} from './adminSchemas';
import { orgSchema, Org } from './orgSchemas';

const adminUserListSchema = z.array(adminUserSchema);
const orgListSchema = z.array(orgSchema);

/**
 * The super-admin read endpoints, verified against `AdminController`.
 *
 * Read-only on purpose. Provisioning shops, changing roles, granting plans and
 * the migration tools stay on the website (PLAN.md §2.4) — those are decisions
 * made at a desk, and half of them are irreversible. What the app adds is the
 * ability to SEE the platform from anywhere, which is what a phone is good for.
 */
export const adminApi = {
  /** Users, shops, subscriptions and projects, counted. */
  stats(): Promise<AdminStats> {
    return apiFetch('/admin/stats').then((d) => adminStatsSchema.parse(d));
  },

  /** Active subscriptions and estimated monthly revenue, per plan. */
  revenue(): Promise<AdminRevenue> {
    return apiFetch('/admin/stats/revenue').then((d) => adminRevenueSchema.parse(d));
  },

  /** How hard the paying accounts are working the AI pipeline. */
  aiUsage(): Promise<AdminAiUsage> {
    return apiFetch('/admin/stats/ai-usage').then((d) => adminAiUsageSchema.parse(d));
  },

  /** The ten newest accounts. */
  recentUsers(): Promise<AdminUser[]> {
    return apiFetch('/admin/users/recent').then((d) => adminUserListSchema.parse(d));
  },

  /** Every organisation on the platform, newest first. */
  organizations(page = 0, size = 200): Promise<Org[]> {
    return apiFetch(`/admin/organizations?page=${page}&size=${size}`).then((d) =>
      orgListSchema.parse(d),
    );
  },
};
