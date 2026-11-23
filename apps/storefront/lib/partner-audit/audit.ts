/**
 * Central, append-only audit logging for partner actions.
 *
 * Every tenant-sensitive partner action (team changes, product submission,
 * order fulfilment decisions, settlement views, ...) records one row in
 * `partner_audit_log` (migration 002). The log is append-only: there is no
 * update/delete path here.
 *
 * Isolation & trust rules:
 *  - `recordPartnerAudit` is a low-level write primitive. All identity fields
 *    (`partnerId`, `actorEmail`, `actorRole`) MUST come from the server-side
 *    partner context (`PartnerContext`), never from a request body/query/header.
 *    Callers should build `metadata` with `auditPayload(...)` so no secrets or
 *    customer PII are persisted.
 *  - `listPartnerAudit` goes through `tenantQuery`, so a caller cannot read
 *    another partner's audit trail — the `partner_id` predicate is injected
 *    from the trusted context, never accepted as an argument.
 */

import { query as defaultQuery, queryResult } from "@/lib/db";
import { tenantQuery, type QueryExecutor } from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

/** Canonical partner action names. Values are stable upper-snake strings. */
export const AUDIT_ACTIONS = {
  MEMBER_INVITED: "MEMBER_INVITED",
  MEMBER_ROLE_CHANGED: "MEMBER_ROLE_CHANGED",
  MEMBER_SUSPENDED: "MEMBER_SUSPENDED",
  SESSIONS_REVOKED: "SESSIONS_REVOKED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  PRODUCT_SUBMITTED: "PRODUCT_SUBMITTED",
  ORDER_ACCEPTED: "ORDER_ACCEPTED",
  ORDER_REJECTED: "ORDER_REJECTED",
  ORDER_FULFILLED: "ORDER_FULFILLED",
  SETTLEMENT_VIEWED: "SETTLEMENT_VIEWED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Input for a single audit row. Identity fields are server-derived. */
export interface PartnerAuditInput {
  partnerId: string;
  actorEmail: string;
  actorRole: string;
  /** Any string is accepted; unknown/custom actions are still recorded. */
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Row shape returned by `listPartnerAudit` (raw DB column names). */
export interface PartnerAuditRow {
  id: string;
  partner_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
}

const INSERT_SQL =
  "INSERT INTO partner_audit_log " +
  "(partner_id, actor_email, actor_role, action, entity_type, entity_id, metadata) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)";

const LIST_SQL =
  "SELECT id, partner_id, actor_email, actor_role, action, entity_type, " +
  "entity_id, metadata, created_at FROM partner_audit_log " +
  "WHERE partner_id = {partner} ORDER BY created_at DESC LIMIT 200";

/**
 * Append one audit row. `executor` is injectable for tests; production uses the
 * shared query function. No validation is applied to `action` — an unrecognised
 * action is still recorded verbatim so new actions are never silently dropped.
 */
export async function recordPartnerAudit(
  input: PartnerAuditInput,
  executor: QueryExecutor = defaultQuery
): Promise<void> {
  await executor(INSERT_SQL, [
    input.partnerId ?? null,
    input.actorEmail,
    input.actorRole,
    input.action,
    input.entityType,
    input.entityId ?? null,
    JSON.stringify(input.metadata ?? {}),
  ]);
}

/**
 * Executor for mutation audit rows. It uses the result-returning DB primitive so
 * an audit write never collides with the row-shape fakes used by the mutation
 * libraries' own tests, while in production it is the very same pool/INSERT as
 * `recordPartnerAudit`'s default executor (same table, same SQL above).
 */
export const AUDIT_EXECUTOR: QueryExecutor = async (sql, params) => {
  const result = await queryResult(sql, params ?? []);
  return result.rows;
};

/**
 * Append an audit row for a *business-critical* mutation and fail loudly if the
 * write does not land. This is deliberately NOT best-effort: a mutation that
 * completes without a durable audit row is invisible to an incident review. The
 * caller (route handler) receives a clear error it can turn into a 5xx rather
 * than returning a success that was never recorded.
 *
 * Identity is still built by the caller from the verified `PartnerContext`; this
 * helper never accepts a client-supplied partner id.
 */
export async function recordMutationAudit(input: PartnerAuditInput): Promise<void> {
  try {
    await recordPartnerAudit(input, AUDIT_EXECUTOR);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[audit] partner mutation audit write failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      partnerId: input.partnerId,
      error: detail,
    });
    throw new Error(
      `Audit write failed for action "${input.action}"; the operation completed but was not recorded.`
    );
  }
}

/**
 * Best-effort correlation/request id from an inbound request. The value is an
 * opaque tracing token (never a tenant id or a secret), so it is safe to persist
 * alongside an audit row when the caller supplies one.
 */
export function correlationIdFrom(req: Request): string | undefined {
  try {
    const value =
      req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || "";
    return value.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** List the authenticated partner's audit trail, newest first. Tenant scoped. */
export function listPartnerAudit(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<PartnerAuditRow[]> {
  return tenantQuery<PartnerAuditRow>(ctx, LIST_SQL, [], ex);
}

/* ── Safe metadata builder ──────────────────────────────────────────────────
 * `auditPayload` is pure: no DB, no cookies, no clock. It shapes the `metadata`
 * passed to `recordPartnerAudit` and guarantees secrets and customer PII are
 * never persisted. It does NOT put the actor's email into metadata — that
 * identity already lives in the `actor_email` column and keeping it out avoids
 * duplicating any email (customer or partner) in a free-form JSON blob.
 * ────────────────────────────────────────────────────────────────────────── */

export const REDACTED = "[REDACTED]";

const MAX_DEPTH = 8;

/** Keys whose values must never be persisted (normalised to spaced words). */
const SENSITIVE_KEY_RE =
  /\b(password|passwd|pwd|secret|token|apikey|api key|authorization|auth header|cookie|session|pan|card number|cardnumber|cvv|cvc|pin|ssn|aadhaar|iban|bank account|routing number|private key|credential|credentials)\b/i;

const EMAIL_VALUE_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PAN_VALUE_RE = /\b\d{13,19}\b/g;

function normaliseKey(key: string): string {
  return key
    // Split camelCase BEFORE lowercasing: `apiToken` must become "api token"
    // so the `\btoken\b` rule fires. Lowercasing first would fuse it into
    // "apitoken", which no word-boundary rule can match.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSensitiveKey(key: string): boolean {
  const k = normaliseKey(key);
  return SENSITIVE_KEY_RE.test(k) || k.includes("email");
}

/** Last line of defence: scrub emails / card numbers even under innocent keys. */
function scrubString(value: string): string {
  return value.replace(EMAIL_VALUE_RE, REDACTED).replace(PAN_VALUE_RE, REDACTED);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : sanitize(val, depth + 1);
    }
    return out;
  }
  // Functions, symbols, bigints: never persist.
  return REDACTED;
}

/**
 * Build a redaction-safe `metadata` payload for an audit row.
 *
 * The `entity` object is recursively sanitised: any key that looks like a
 * secret (password, token, PAN/card number, ...) or an email address is replaced
 * with `[REDACTED]`, and raw string values are additionally scrubbed for emails
 * and 13–19 digit card numbers. Safe scalar fields are preserved so the audit
 * trail remains useful.
 */
export function auditPayload(
  action: string,
  ctx: PartnerContext,
  entity: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    action,
    partnerId: ctx?.partnerId ?? "",
    actorRole: ctx?.role ?? "",
    entity: sanitize(entity) as Record<string, unknown>,
  };
}

/**
 * Redact a free-form value for the *admin* audit log, which has no JSON metadata
 * builder of its own. Reuses the exact same last-line-of-defence scrubber as
 * `auditPayload` so emails, PANs and card numbers never reach either audit table.
 */
export function redactAuditText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : String(value);
  const redacted = scrubString(text);
  return redacted.trim() ? redacted : null;
}
