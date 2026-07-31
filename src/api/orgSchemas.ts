import { z } from 'zod';

/**
 * Wire schemas for the organisation hierarchy — `com.gridstore.huevista.account.dto`
 * and `...hierarchy.dto`.
 *
 * The trade runs Distributor → Retailer → Painter → Customer, and almost every
 * non-customer screen needs to know where the signed-in account sits in it: which
 * org it owns, which paint companies it may work with, and which pages its
 * distributor left switched on.
 */

/** Backend `OrgType`. */
export const ORG_TYPES = ['DISTRIBUTOR', 'RETAILER'] as const;
export const orgTypeSchema = z.enum(ORG_TYPES);
export type OrgType = (typeof ORG_TYPES)[number];

/** OrgResponse — `GET /api/organizations/mine`. */
export const orgSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  slug: z.string().nullish(),
  type: orgTypeSchema.nullish(),
  ownerUserId: z.string().nullish(),
  ownerName: z.string().nullish(),
  whitelabelEnabled: z.boolean().nullish(),
  subdomainSlug: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type Org = z.infer<typeof orgSchema>;

/**
 * MyAccessResponse — `GET /api/hierarchy/my-access`.
 *
 * What this account's distributor has granted it: paint companies, and pages.
 * `allowedPaths` are the WEBSITE routes each feature gates — the contract the
 * two clients share — so the app maps them to its own tabs rather than inventing
 * a second list that would drift from the one the backend enforces.
 */
export const myAccessSchema = z.object({
  role: z.string().nullish(),
  orgId: z.string().nullish(),
  orgName: z.string().nullish(),
  brandsRestricted: z.boolean().default(false),
  allowedBrands: z.array(z.string()).default([]),
  featuresRestricted: z.boolean().default(false),
  allowedFeatures: z.array(z.string()).default([]),
  allowedPaths: z.array(z.string()).default([]),
});
export type MyAccess = z.infer<typeof myAccessSchema>;

/**
 * NetworkNodeResponse — one account in the downline, with its own children.
 *
 * Recursive, so the schema is declared with an explicit type: zod cannot infer a
 * self-reference on its own.
 */
export interface NetworkNode {
  userId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  joinedAt?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  city?: string | null;
  state?: string | null;
  retailerCount: number;
  painterCount: number;
  codesIssued: number;
  codesRedeemed: number;
  assignedBrands: string[];
  brandsRestricted: boolean;
  assignedFeatures: string[];
  featuresRestricted: boolean;
  children: NetworkNode[];
}

export const networkNodeSchema: z.ZodType<NetworkNode> = z.lazy(() =>
  z.object({
    userId: z.string(),
    name: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    role: z.string().nullish(),
    joinedAt: z.string().nullish(),
    orgId: z.string().nullish(),
    orgName: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    retailerCount: z.number().default(0),
    painterCount: z.number().default(0),
    codesIssued: z.number().default(0),
    codesRedeemed: z.number().default(0),
    assignedBrands: z.array(z.string()).default([]),
    brandsRestricted: z.boolean().default(false),
    assignedFeatures: z.array(z.string()).default([]),
    featuresRestricted: z.boolean().default(false),
    children: z.array(networkNodeSchema).default([]),
  }),
);

/** NetworkReportResponse — `GET /api/hierarchy/network`. */
export const networkReportSchema = z.object({
  viewerRole: z.string().nullish(),
  /** Head-line counts, keyed by the backend ("retailers", "painters", …). */
  totals: z.record(z.string(), z.number()).default({}),
  roots: z.array(networkNodeSchema).default([]),
});
export type NetworkReport = z.infer<typeof networkReportSchema>;

/** RetailerBrandOption — a paint company, and whether this shop has it. */
export const retailerBrandOptionSchema = z.object({
  id: z.number().nullish(),
  name: z.string(),
  slug: z.string().nullish(),
  assigned: z.boolean().default(false),
});
export type RetailerBrandOption = z.infer<typeof retailerBrandOptionSchema>;

/** RetailerFeatureOption — a page a distributor can switch on for a shop. */
export const retailerFeatureOptionSchema = z.object({
  key: z.string(),
  label: z.string().nullish(),
  path: z.string().nullish(),
  description: z.string().nullish(),
  assigned: z.boolean().default(false),
});
export type RetailerFeatureOption = z.infer<typeof retailerFeatureOptionSchema>;
