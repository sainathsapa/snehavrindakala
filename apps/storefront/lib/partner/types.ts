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

export type PartnerRole =
  | "owner"
  | "manager"
  | "operations"
  | "finance"
  | "viewer";

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

export function isPartnerRole(value: unknown): value is PartnerRole {
  return (
    value === "owner" ||
    value === "manager" ||
    value === "operations" ||
    value === "finance" ||
    value === "viewer"
  );
}
