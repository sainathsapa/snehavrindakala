/**
 * Business-facing partner portal services: team membership, business profile and
 * account security.
 *
 * EVERY query that touches partner-owned rows is tenant-scoped. The only source
 * of `partner_id` is the server-derived `PartnerContext`; a caller can never pass
 * a tenant id. Updates that address a membership by id always also filter on
 * `partner_id = {partner}`, so a foreign id is a silent no-op rather than a
 * cross-tenant write.
 */

import { randomBytes } from "crypto";
import { query as defaultQuery } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/partner/password";
import {
  getPartnerProfile,
  listPartnerMembers,
  tenantQuery,
  type QueryExecutor,
} from "@/lib/partner/repository";
import {
  isPartnerRole,
  isPartnerOwnerRole,
  type PartnerContext,
  type PartnerRole,
} from "@/lib/partner/types";

/** Columns safe to return to a portal client (never includes password_hash). */
const MEMBER_COLUMNS =
  "id, partner_id, email, full_name, role, status, token_version, " +
  "last_login_at, created_at, updated_at";

const PROFILE_COLUMNS =
  "id, legal_name, display_name, slug, contact_email, contact_phone, " +
  "business_profile, registration_details, account_status, verification_status, " +
  "created_at, updated_at";

/** The only partner columns a partner user is allowed to edit. */
const SAFE_PROFILE_FIELDS = [
  "display_name",
  "contact_email",
  "contact_phone",
  "business_profile",
] as const;

/** Status/ownership columns must never be reachable from a portal patch. */
const FORBIDDEN_PROFILE_FIELDS = new Set([
  "account_status",
  "verification_status",
  "status",
  "id",
  "partner_id",
  "partnerId",
  "slug",
  "artist_id",
  "approval_history",
  "registration_details",
  "legal_name",
  "created_at",
  "updated_at",
]);

/** Keys that would attempt to smuggle a tenant id into a request body. */
const TENANT_ID_KEYS = [
  "partner_id",
  "partnerId",
  "tenant_id",
  "tenantId",
  "partner",
];

export interface ManagedMember {
  id: string;
  partner_id: string;
  email: string;
  full_name: string;
  role: PartnerRole;
  status: string;
  token_version: number;
  last_login_at?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface InviteInput {
  email: string;
  fullName?: string;
  role?: unknown;
}

export interface ProfilePatch {
  display_name?: string;
  contact_email?: string;
  contact_phone?: string | null;
  business_profile?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface InviteResult {
  member: ManagedMember | null;
  /** One-time temporary credential. Never stored in plaintext or returned again. */
  tempPassword: string;
}

function run(ex?: QueryExecutor): QueryExecutor {
  return ex ?? defaultQuery;
}

/** Guard for route handlers: reject any tenant id supplied by the client. */
export function hasTenantIdField(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  return TENANT_ID_KEYS.some((key) => key in record);
}

/** Tenant-scoped membership lookup; returns null for a foreign or missing id. */
async function findScopedMember(
  ctx: PartnerContext,
  memberId: string,
  ex?: QueryExecutor
): Promise<ManagedMember | null> {
  if (typeof memberId !== "string" || !memberId) return null;
  const rows = await tenantQuery<ManagedMember>(
    ctx,
    `SELECT ${MEMBER_COLUMNS} FROM partner_membership ` +
      `WHERE id = $1 AND partner_id = {partner} LIMIT 1`,
    [memberId],
    run(ex)
  );
  return rows[0] ?? null;
}

/**
 * Refuse to strip owner status from the last active owner of a partner. Without
 * this, a single owner could demote or suspend themselves and strand the account
 * with no administrator.
 */
async function assertNotLastOwner(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<void> {
  const rows = await tenantQuery<{ count: number }>(
    ctx,
    "SELECT count(*)::int AS count FROM partner_membership " +
      "WHERE partner_id = {partner} AND role IN ('owner','partner_owner') AND status = 'active'",
    [],
    run(ex)
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count <= 1) {
    throw new Error(
      "Cannot remove the last active owner. Invite or promote another owner first."
    );
  }
}

/** List the members of the authenticated partner only. */
export function listMembers(ctx: PartnerContext, ex?: QueryExecutor) {
  return listPartnerMembers(ctx, ex);
}

/**
 * Invite a member. A random temporary password is generated, hashed with scrypt
 * and stored; the plaintext is returned to the caller exactly once so it can be
 * handed to the invitee out of band. The new membership starts as `invited` and
 * becomes usable only after an admin/owner activates it.
 */
export async function inviteMember(
  ctx: PartnerContext,
  input: InviteInput,
  ex?: QueryExecutor
): Promise<InviteResult> {
  if (!ctx?.partnerId) throw new Error("Partner context required");

  const email =
    typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required");
  }

  const role = input.role === undefined ? "viewer" : input.role;
  if (!isPartnerRole(role)) throw new Error("Invalid partner role");

  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";

  // 18 random bytes -> 24 base64url chars; comfortably above the 12-char minimum.
  const tempPassword = randomBytes(18).toString("base64url");
  const passwordHash = hashPassword(tempPassword);

  const rows = await tenantQuery<ManagedMember>(
    ctx,
    `INSERT INTO partner_membership ` +
      `(partner_id, email, password_hash, full_name, role, status) ` +
      `VALUES ({partner}, $1, $2, $3, $4, 'invited') ` +
      `RETURNING ${MEMBER_COLUMNS}`,
    [email, passwordHash, fullName, role],
    run(ex)
  );

  return { member: rows[0] ?? null, tempPassword };
}

/**
 * Change a member's role. The row is addressed by id AND partner_id, so a
 * foreign id affects nothing. Demoting the last active owner is refused.
 */
export async function changeMemberRole(
  ctx: PartnerContext,
  memberId: string,
  role: unknown,
  ex?: QueryExecutor
): Promise<ManagedMember | null> {
  if (!isPartnerRole(role)) throw new Error("Invalid partner role");

  const target = await findScopedMember(ctx, memberId, ex);
  if (!target) return null;

  if (
    isPartnerOwnerRole(target.role) &&
    !isPartnerOwnerRole(role) &&
    target.status === "active"
  ) {
    await assertNotLastOwner(ctx, ex);
  }

  // `role` is one of the five fixed, validated names (isPartnerRole above), so
  // inlining it is safe and keeps the tenant predicate at $1/$2 exactly:
  //   WHERE id = $1 AND partner_id = $2
  const rows = await tenantQuery<ManagedMember>(
    ctx,
    `UPDATE partner_membership SET role = '${role}', updated_at = now() ` +
      `WHERE id = $1 AND partner_id = {partner} RETURNING ${MEMBER_COLUMNS}`,
    [memberId],
    run(ex)
  );
  return rows[0] ?? null;
}

/**
 * Suspend a member. Self-suspension and removing the last active owner are
 * forbidden. Suspending also bumps token_version so any live session dies at
 * once (resolvePartnerContext rejects both the status and the stale version).
 */
export async function suspendMember(
  ctx: PartnerContext,
  memberId: string,
  ex?: QueryExecutor
): Promise<ManagedMember | null> {
  if (memberId === ctx.membershipId) {
    throw new Error("You cannot suspend your own membership");
  }

  const target = await findScopedMember(ctx, memberId, ex);
  if (!target) return null;
  if (target.status === "suspended") return target;

  if (isPartnerOwnerRole(target.role) && target.status === "active") {
    await assertNotLastOwner(ctx, ex);
  }

  const rows = await tenantQuery<ManagedMember>(
    ctx,
    `UPDATE partner_membership ` +
      `SET status = 'suspended', token_version = token_version + 1, updated_at = now() ` +
      `WHERE id = $1 AND partner_id = {partner} RETURNING ${MEMBER_COLUMNS}`,
    [memberId],
    run(ex)
  );
  return rows[0] ?? null;
}

/** Revoke every existing session for one member by bumping token_version. */
export async function revokeMemberSessions(
  ctx: PartnerContext,
  memberId: string,
  ex?: QueryExecutor
): Promise<ManagedMember | null> {
  const rows = await tenantQuery<ManagedMember>(
    ctx,
    `UPDATE partner_membership ` +
      `SET token_version = token_version + 1, updated_at = now() ` +
      `WHERE id = $1 AND partner_id = {partner} RETURNING ${MEMBER_COLUMNS}`,
    [memberId],
    run(ex)
  );
  return rows[0] ?? null;
}

/**
 * Update the partner's own business profile. Only the four allow-listed columns
 * are ever written; status/verification/ownership columns are rejected outright.
 * The single WHERE predicate is the server-derived partner id.
 */
export async function updateProfile(
  ctx: PartnerContext,
  patch: ProfilePatch,
  ex?: QueryExecutor
): Promise<any | null> {
  if (!ctx?.partnerId) throw new Error("Partner context required");
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Invalid profile patch");
  }

  for (const key of FORBIDDEN_PROFILE_FIELDS) {
    if (key in patch) throw new Error(`Profile updates cannot change ${key}`);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const field of SAFE_PROFILE_FIELDS) {
    if (!(field in patch)) continue;
    let value = patch[field];

    if (field === "business_profile") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("business_profile must be an object");
      }
      value = JSON.stringify(value);
    } else {
      if (value === "") value = null;
      if (value !== null && typeof value !== "string") {
        throw new Error(`${field} must be a string`);
      }
    }

    params.push(value);
    sets.push(`${field} = $${params.length}`);
  }

  if (sets.length === 0) throw new Error("No updatable profile fields provided");
  sets.push("updated_at = now()");

  const rows = await tenantQuery<any>(
    ctx,
    `UPDATE partner SET ${sets.join(", ")} WHERE id = {partner} RETURNING ${PROFILE_COLUMNS}`,
    params,
    run(ex)
  );
  return rows[0] ?? null;
}

/**
 * Change the current member's password. The existing password must verify, the
 * new one is hashed before storage, and token_version is bumped so all existing
 * sessions (including this one) are revoked.
 */
export async function changeOwnPassword(
  ctx: PartnerContext,
  currentPassword: unknown,
  newPassword: unknown,
  ex?: QueryExecutor
): Promise<boolean> {
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return false;
  }

  const rows = await tenantQuery<{
    id: string;
    password_hash: string;
    token_version: number;
  }>(
    ctx,
    `SELECT id, password_hash, token_version FROM partner_membership ` +
      `WHERE id = $1 AND partner_id = {partner} LIMIT 1`,
    [ctx.membershipId],
    run(ex)
  );
  const member = rows[0];
  if (!member || typeof member.password_hash !== "string") return false;
  if (!verifyPassword(currentPassword, member.password_hash)) return false;

  let newHash: string;
  try {
    newHash = hashPassword(newPassword);
  } catch {
    return false;
  }

  const updated = await tenantQuery<{ token_version: number }>(
    ctx,
    `UPDATE partner_membership ` +
      `SET password_hash = $1, token_version = token_version + 1, updated_at = now() ` +
      `WHERE id = $2 AND partner_id = {partner} RETURNING token_version`,
    [newHash, ctx.membershipId],
    run(ex)
  );
  return typeof updated[0]?.token_version === "number";
}

/** Read the authenticated partner's profile (tenant-scoped). */
export function readProfile(ctx: PartnerContext, ex?: QueryExecutor) {
  return getPartnerProfile(ctx, ex);
}
