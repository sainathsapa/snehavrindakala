/**
 * First-class marketplace partner domain types.
 *
 * A "partner" is a business account that can own products, inventory, orders and
 * financial records. It is deliberately NOT the same concept as a public
 * artist/maker (site_artist) or a Medusa admin user. The mapping between an
 * artist and a partner is.admin-assisted and nullable — an artist is never
 * silently promoted to a partner with privileges.
 */

export type PartnerAccountStatus = "pending" | "active" | "suspended" | "rejected";
export type PartnerVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

/**
 * Partner-portal roles are explicitly namespaced with `partner_` so they can
 * never be interpreted as platform (admin) roles — the two string domains are
 * disjoint. The bare names are legacy transition aliases (see
 * db/migrations/006_role_namespacing.sql); they are accepted on read and mapped
 * to their canonical `partner_*` value by `canonicalPartnerRole`. No bare name
 * is ever handed to a platform permission check.
 */
export type PartnerRoleCanonical =
  | "partner_owner"
  | "partner_manager"
  | "partner_operations"
  | "partner_finance"
  | "partner_viewer";

export type PartnerRoleLegacy =
  | "owner"
  | "manager"
  | "operations"
  | "finance"
  | "viewer";

export type PartnerRole = PartnerRoleCanonical | PartnerRoleLegacy;

export type MembershipStatus = "invited" | "active" | "suspended";

export interface Partner {
  id: string;
  legal_name: string;
  display_name: string;
  slug: string;
  contact_email: string;
  contact_phone?: string | null;
  business_profile: Record<string, unknown>;
  registration_details: Record<string, unknown>;
  account_status: PartnerAccountStatus;
  verification_status: PartnerVerificationStatus;
  approval_history: Array<Record<string, unknown>>;
  artist_id?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface PartnerMembership {
  id: string;
  partner_id: string;
  email: string;
  full_name: string;
  role: PartnerRole;
  status: MembershipStatus;
  token_version: number;
  last_login_at?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Server-derived partner context. `partnerId` ALWAYS comes from the verified
 * session + membership lookup, never from the request. Every repository query
 * that touches tenant-owned data requires this object and scopes by partnerId.
 */
export interface PartnerContext {
  partnerId: string;
  membershipId: string;
  email: string;
  role: PartnerRole;
  tokenVersion: number;
  displayName?: string;
}

export interface PartnerSessionPayload {
  pid: string; // partner id
  mid: string; // membership id
  role: PartnerRole;
  ver: number; // token version
  email: string;
  exp: number; // unix seconds
}

const CANONICAL_PARTNER_VALUES = new Set<string>([
  "partner_owner", "partner_manager", "partner_operations",
  "partner_finance", "partner_viewer",
]);

const LEGACY_PARTNER_VALUES = new Set<string>([
  "owner", "manager", "operations", "finance", "viewer",
]);

/** Accepts both canonical `partner_*` values and legacy bare names (transition). */
export function isPartnerRole(value: unknown): value is PartnerRole {
  return (
    typeof value === "string" &&
    (CANONICAL_PARTNER_VALUES.has(value) || LEGACY_PARTNER_VALUES.has(value))
  );
}

/** True only for a canonical, namespaced partner role value. */
export function isCanonicalPartnerRole(value: unknown): value is PartnerRoleCanonical {
  return typeof value === "string" && CANONICAL_PARTNER_VALUES.has(value);
}

/** Legacy bare partner name → canonical `partner_*` value. */
const LEGACY_TO_CANONICAL_PARTNER: Record<PartnerRoleLegacy, PartnerRoleCanonical> = {
  owner: "partner_owner",
  manager: "partner_manager",
  operations: "partner_operations",
  finance: "partner_finance",
  viewer: "partner_viewer",
};

/**
 * Fail-closed boundary for partner role claims. Accepts a canonical partner
 * role or a legacy bare partner name; platform roles (bare or `platform_*`) and
 * unknown values are rejected with null. The returned value is always a
 * canonical `partner_*` role.
 */
export function partnerRoleOrNull(value: unknown): PartnerRoleCanonical | null {
  if (typeof value !== "string") return null;
  if (CANONICAL_PARTNER_VALUES.has(value)) return value as PartnerRoleCanonical;
  if (LEGACY_PARTNER_VALUES.has(value)) {
    return LEGACY_TO_CANONICAL_PARTNER[value as PartnerRoleLegacy];
  }
  return null;
}

/** Alias used at resolution boundaries; identical semantics to partnerRoleOrNull. */
export function canonicalPartnerRole(value: unknown): PartnerRoleCanonical | null {
  return partnerRoleOrNull(value);
}

/** True for either the legacy or canonical spelling of the partner owner role. */
export function isPartnerOwnerRole(value: unknown): boolean {
  return value === "owner" || value === "partner_owner";
}
