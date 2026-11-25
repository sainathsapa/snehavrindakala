/**
 * Platform-admin lifecycle management for first-class marketplace partners.
 *
 * This is deliberately SEPARATE from the legacy artist-based
 * `/api/admin/partners` screens (which proxy `site_artist` to Medusa). Here a
 * "partner" is a row in the `partner` table created by the onboarding review
 * workflow, and its lifecycle is controlled only through the explicit
 * functions below.
 *
 * HARD RULES enforced here:
 *  - There is NO generic "update partner profile" function. A payload that
 *    happens to contain `account_status` / `verification_status` therefore has
 *    no code path to those columns; they can only be changed through
 *    `setAccountStatus` / `setVerification` with a validated enum value.
 *  - Linking an artist NEVER activates a partner and NEVER verifies it. An
 *    artist is not silently promoted to a partner; the link is recorded in
 *    `approval_history` and audited, nothing more.
 *  - Verification is never automatic. Only `setVerification`, called by an
 *    explicit admin with non-empty notes, can set `verified`.
 *  - Every mutation appends to `approval_history` and writes one row to the
 *    append-only `partner_audit_log`. No function deletes anything.
 *
 * All functions accept an optional injectable executor (or deps object) so the
 * workflow is testable with a fake DB. The `partner id` is always an explicit
 * argument supplied by a server-side route from the URL path — never read from
 * a request body/query/header.
 */

import { query as dbQuery } from "@/lib/db";
import {
  assertCommerciallyActivatable,
  CommercialValidationError,
} from "./commercial";

/* ── Types & constants ────────────────────────────────────────────────────── */

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export const ACCOUNT_STATUSES = [
  "pending",
  "active",
  "suspended",
  "rejected",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === "string" &&
    (ACCOUNT_STATUSES as readonly string[]).includes(value)
  );
}

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    typeof value === "string" &&
    (VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

export interface Partner {
  id: string;
  legal_name: string;
  display_name: string;
  slug: string;
  contact_email: string;
  contact_phone: string | null;
  business_profile: Record<string, unknown>;
  registration_details: Record<string, unknown>;
  account_status: AccountStatus;
  verification_status: VerificationStatus;
  approval_history: Array<Record<string, unknown>>;
  artist_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Injectable dependencies. `ex` may be a bare executor or this full object. */
export interface PlatformDeps {
  executor?: QueryExecutor;
  /** Injectable clock so approval_history timestamps are deterministic. */
  now?: () => Date;
  /** Admin note; REQUIRED by setVerification, optional for the other actions. */
  notes?: string | null;
  /** Role recorded in the audit row. Defaults to "platform_admin". */
  actorRole?: string;
}

export type PlatformEx = QueryExecutor | PlatformDeps;

interface ResolvedDeps {
  executor: QueryExecutor;
  now: () => Date;
  notes?: string | null;
  actorRole: string;
}

const defaultDeps: ResolvedDeps = {
  executor: (sql, params = []) => dbQuery(sql, params),
  now: () => new Date(),
  actorRole: "platform_admin",
};

function resolveDeps(ex?: PlatformEx): ResolvedDeps {
  if (!ex) return defaultDeps;
  if (typeof ex === "function") return { ...defaultDeps, executor: ex };
  return { ...defaultDeps, ...ex };
}

/* ── Errors (route handlers map these to HTTP statuses) ──────────────────── */

export class PlatformValidationError extends Error {
  /** Machine-readable reasons, when the failure has them (e.g. activation). */
  readonly blockers?: string[];
  constructor(message: string, blockers?: string[]) {
    super(message);
    this.name = "PlatformValidationError";
    if (blockers?.length) this.blockers = blockers;
  }
}
export class PartnerNotFoundError extends Error {
  constructor(message = "Partner not found.") {
    super(message);
    this.name = "PartnerNotFoundError";
  }
}
export class ArtistNotFoundError extends Error {
  constructor(message = "Artist not found.") {
    super(message);
    this.name = "ArtistNotFoundError";
  }
}

/* ── Validation helpers ───────────────────────────────────────────────────── */

function requireId(id: unknown, label = "partner id"): string {
  if (typeof id !== "string" || !id.trim() || id.length > 128) {
    throw new PlatformValidationError(`A valid ${label} is required.`);
  }
  return id.trim();
}

function requireActor(actor: unknown): string {
  if (typeof actor !== "string" || !actor.trim()) {
    throw new PlatformValidationError("An admin actor email is required.");
  }
  return actor.trim().toLowerCase();
}

function requireNotes(notes: unknown): string {
  if (typeof notes !== "string" || !notes.trim()) {
    throw new PlatformValidationError(
      "Verification requires explicit admin notes."
    );
  }
  return notes.trim().slice(0, 2000);
}

function optionalNotes(notes: unknown): string | null {
  if (notes == null) return null;
  if (typeof notes !== "string") {
    throw new PlatformValidationError("Notes must be text.");
  }
  return notes.slice(0, 2000) || null;
}

/** site_artist.id is an integer serial; partner.artist_id stores it as text. */
function requireArtistId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,20}$/.test(id)) {
    throw new PlatformValidationError("A valid numeric artist id is required.");
  }
  return id;
}

function boundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/* ── Audit ────────────────────────────────────────────────────────────────── */

interface AuditEntry {
  partnerId: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/** Append-only. Never updated or deleted. */
async function writeAudit(
  executor: QueryExecutor,
  entry: AuditEntry
): Promise<void> {
  await executor(
    `INSERT INTO partner_audit_log
       (partner_id, actor_email, actor_role, action, entity_type, entity_id,
        metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      entry.partnerId,
      entry.actor,
      entry.actorRole,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.timestamp,
    ]
  );
}

/** Append an entry to the JSONB approval_history array atomically. */
const APPEND_HISTORY =
  "approval_history = COALESCE(approval_history, '[]'::jsonb) || $2::jsonb";

/* ── Reads (platform-level, not tenant-scoped) ───────────────────────────── */

export interface ListPartnersFilters {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
export interface PartnerListResult {
  partners: Partner[];
  count: number;
}

/**
 * List partners. `ex` is the first optional argument (injectable executor /
 * deps); filters are an optional second argument for the admin list screen.
 */
export async function listPartners(
  ex?: PlatformEx,
  filters: ListPartnersFilters = {}
): Promise<PartnerListResult> {
  const deps = resolveDeps(ex);
  const where: string[] = [];
  const params: any[] = [];

  if (filters.status && filters.status !== "all") {
    if (!isAccountStatus(filters.status)) {
      throw new PlatformValidationError("Invalid account status filter.");
    }
    params.push(filters.status);
    where.push(`account_status = $${params.length}`);
  }
  if (typeof filters.q === "string" && filters.q.trim()) {
    params.push(`%${filters.q.trim()}%`);
    const p = params.length;
    where.push(
      `(legal_name ILIKE $${p} OR display_name ILIKE $${p} ` +
        `OR contact_email ILIKE $${p} OR slug ILIKE $${p})`
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = boundedInt(filters.limit, 20, 1, 200);
  const offset = boundedInt(filters.offset, 0, 0, 1_000_000);

  const rows = await deps.executor(
    `SELECT * FROM partner ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const countRows = await deps.executor(
    `SELECT COUNT(*)::text AS count FROM partner ${whereSql}`,
    params
  );
  return {
    partners: rows as Partner[],
    count: Number(countRows[0]?.count ?? rows.length),
  };
}

export async function getPartner(
  id: string,
  ex?: PlatformEx
): Promise<Partner | null> {
  const deps = resolveDeps(ex);
  const pid = requireId(id);
  const rows = await deps.executor(
    "SELECT * FROM partner WHERE id = $1 LIMIT 1",
    [pid]
  );
  return (rows[0] as Partner) ?? null;
}

/* ── Mutations ────────────────────────────────────────────────────────────── */

/**
 * Set the account lifecycle status. This is the ONLY function that writes
 * `account_status`. Notes are optional and recorded in both histories.
 */
export async function setAccountStatus(
  id: string,
  status: AccountStatus,
  actor: string,
  ex?: PlatformEx
): Promise<Partner> {
  const deps = resolveDeps(ex);
  const pid = requireId(id);
  if (!isAccountStatus(status)) {
    throw new PlatformValidationError(
      "Invalid account status. Expected one of: pending, active, suspended, rejected."
    );
  }
  const who = requireActor(actor);
  const notes = optionalNotes(deps.notes);
  const timestamp = deps.now().toISOString();

  const existing = await deps.executor(
    "SELECT account_status FROM partner WHERE id = $1 LIMIT 1",
    [pid]
  );
  const current = existing[0] as { account_status?: string } | undefined;
  if (!current) throw new PartnerNotFoundError();

  // COMMERCIAL GATE.
  //
  // `active` is not just a label: it unlocks the partner portal, listing and
  // settlement. It therefore requires a signed, in-force agreement and an
  // approved commission/payout configuration. Checked here rather than only in
  // the route so every caller — admin action, API route, backfill script — hits
  // the same rule.
  //
  // Re-activating an already-active partner is still gated: an agreement that
  // lapsed while the partner was live must not be quietly ignored.
  if (status === "active") {
    try {
      await assertCommerciallyActivatable(
        pid,
        deps.now().toISOString().slice(0, 10),
        deps.executor as any
      );
    } catch (err) {
      if (err instanceof CommercialValidationError) {
        throw new PlatformValidationError(
          err.message,
          err.blockers as unknown as string[]
        );
      }
      throw err;
    }
  }

  const entry = {
    action: "account_status",
    from: current.account_status ?? null,
    to: status,
    actor: who,
    timestamp,
    ...(notes ? { notes } : {}),
  };

  // NOTE: verification_status is intentionally NOT touched here.
  const rows = await deps.executor(
    `UPDATE partner
        SET account_status = $1, ${APPEND_HISTORY}, updated_at = $3
      WHERE id = $4
      RETURNING *`,
    [status, JSON.stringify([entry]), timestamp, pid]
  );
  const updated = (rows[0] as Partner) ?? null;
  if (!updated) throw new PartnerNotFoundError();

  await writeAudit(deps.executor, {
    partnerId: pid,
    actor: who,
    actorRole: deps.actorRole,
    action: "set_account_status",
    entityType: "partner",
    entityId: pid,
    metadata: { from: current.account_status ?? null, to: status, notes },
    timestamp,
  });
  return updated;
}

/**
 * Set the verification status. Verification is NEVER automatic: the caller must
 * be an explicit admin (the route enforces partners:write) and must supply
 * non-empty notes. This is the ONLY function that writes `verification_status`.
 */
export async function setVerification(
  id: string,
  status: VerificationStatus,
  actor: string,
  ex?: PlatformEx
): Promise<Partner> {
  const deps = resolveDeps(ex);
  const pid = requireId(id);
  if (!isVerificationStatus(status)) {
    throw new PlatformValidationError(
      "Invalid verification status. Expected one of: unverified, pending, verified, rejected."
    );
  }
  const who = requireActor(actor);
  const notes = requireNotes(deps.notes);
  const timestamp = deps.now().toISOString();

  const existing = await deps.executor(
    "SELECT verification_status FROM partner WHERE id = $1 LIMIT 1",
    [pid]
  );
  const current = existing[0] as { verification_status?: string } | undefined;
  if (!current) throw new PartnerNotFoundError();

  const entry = {
    action: "verification_status",
    from: current.verification_status ?? null,
    to: status,
    actor: who,
    timestamp,
    notes,
  };

  // NOTE: account_status is intentionally NOT touched here.
  const rows = await deps.executor(
    `UPDATE partner
        SET verification_status = $1, ${APPEND_HISTORY}, updated_at = $3
      WHERE id = $4
      RETURNING *`,
    [status, JSON.stringify([entry]), timestamp, pid]
  );
  const updated = (rows[0] as Partner) ?? null;
  if (!updated) throw new PartnerNotFoundError();

  await writeAudit(deps.executor, {
    partnerId: pid,
    actor: who,
    actorRole: deps.actorRole,
    action: "set_verification",
    entityType: "partner",
    entityId: pid,
    metadata: { from: current.verification_status ?? null, to: status, notes },
    timestamp,
  });
  return updated;
}

/**
 * Admin-assisted artist↔partner mapping. An artist is NEVER automatically made
 * an active partner: only `artist_id` and `approval_history` are changed —
 * `account_status` and `verification_status` are deliberately left untouched.
 */
export async function linkArtist(
  partnerId: string,
  artistId: string,
  actor: string,
  ex?: PlatformEx
): Promise<Partner> {
  const deps = resolveDeps(ex);
  const pid = requireId(partnerId);
  const aid = requireArtistId(artistId);
  const who = requireActor(actor);
  const notes = optionalNotes(deps.notes);
  const timestamp = deps.now().toISOString();

  const existing = await deps.executor(
    "SELECT id, artist_id FROM partner WHERE id = $1 LIMIT 1",
    [pid]
  );
  const current = existing[0] as { id?: string; artist_id?: string | null } | undefined;
  if (!current) throw new PartnerNotFoundError();

  const artistRows = await deps.executor(
    "SELECT id FROM site_artist WHERE id::text = $1 LIMIT 1",
    [aid]
  );
  if (!artistRows[0]) throw new ArtistNotFoundError();

  const entry = {
    action: "link_artist",
    artist_id: aid,
    previous_artist_id: current.artist_id ?? null,
    actor: who,
    timestamp,
    ...(notes ? { notes } : {}),
  };

  // NOTE: NO account_status / verification_status assignment. Linking alone
  // cannot promote an artist to an active or verified partner.
  const rows = await deps.executor(
    `UPDATE partner
        SET artist_id = $1, ${APPEND_HISTORY}, updated_at = $3
      WHERE id = $4
      RETURNING *`,
    [aid, JSON.stringify([entry]), timestamp, pid]
  );
  const updated = (rows[0] as Partner) ?? null;
  if (!updated) throw new PartnerNotFoundError();

  await writeAudit(deps.executor, {
    partnerId: pid,
    actor: who,
    actorRole: deps.actorRole,
    action: "link_artist",
    entityType: "partner",
    entityId: pid,
    metadata: { artist_id: aid, notes },
    timestamp,
  });
  return updated;
}
