/**
 * Admin review workflow for public partner onboarding applications.
 *
 * SERVER-ONLY. Every public function here is intended for route handlers or
 * Server Actions that enforce `requirePermission("partners:read"|"partners:write")`
 * before calling it. Never import this module from a client component.
 *
 * Identity rule: approval never fabricates a partner. Every partner field is
 * copied from the submitted application; the admin only confirms the decision.
 * The one value that is generated here is a temporary owner password, which is
 * hashed before it is written and returned to the admin exactly once so it can
 * be handed to the partner out of band.
 */

import { randomBytes } from "crypto";
import { query as dbQuery, transaction as dbTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/partner/password";
import { slugify } from "@/lib/slug";

export const REVIEW_DECISIONS = [
  "pending",
  "more_info",
  "approved",
  "rejected",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface OnboardingApplication {
  id: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  contact_phone: string | null;
  business_details: Record<string, unknown>;
  artist_information: Record<string, unknown>;
  product_categories: unknown[];
  document_keys: unknown[];
  review_status: ReviewDecision;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_partner_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Injectable database boundary (makes the workflow testable with a fake) ─ */

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export type TransactionRunner = <T>(
  fn: (exec: QueryExecutor) => Promise<T>
) => Promise<T>;

export interface ReviewDeps {
  query: QueryExecutor;
  transaction: TransactionRunner;
  /** Injectable clock so approval_history timestamps are deterministic in tests. */
  now?: () => Date;
}

const defaultDeps: ReviewDeps = {
  query: (sql, params = []) => dbQuery(sql, params),
  transaction: <T,>(fn: (exec: QueryExecutor) => Promise<T>): Promise<T> =>
    dbTransaction<T>((client) =>
      fn((sql, params = []) => client.query(sql, params).then((r) => r.rows))
    ),
};

/* ── Errors (callers map these to HTTP statuses) ─────────────────────────── */

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewValidationError";
  }
}

export class ApplicationNotFoundError extends Error {
  constructor(message = "Application not found.") {
    super(message);
    this.name = "ApplicationNotFoundError";
  }
}

export class AlreadyReviewedError extends Error {
  constructor(message = "This application has already been approved.") {
    super(message);
    this.name = "AlreadyReviewedError";
  }
}

/* ── Validation ──────────────────────────────────────────────────────────── */

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return (
    typeof value === "string" &&
    (REVIEW_DECISIONS as readonly string[]).includes(value)
  );
}

export interface ReviewInput {
  id: string;
  decision: ReviewDecision;
  reviewerId: string;
  notes?: string | null;
}

export function validateReviewInput(input: unknown): ReviewInput {
  if (!input || typeof input !== "object") {
    throw new ReviewValidationError("Review input must be an object.");
  }
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id || id.length > 128) {
    throw new ReviewValidationError("A valid application id is required.");
  }
  if (!isReviewDecision(raw.decision)) {
    throw new ReviewValidationError(
      "Invalid decision. Expected one of: pending, more_info, approved, rejected."
    );
  }
  const reviewerId =
    typeof raw.reviewerId === "string" ? raw.reviewerId.trim() : "";
  if (!reviewerId) {
    throw new ReviewValidationError("A reviewer identity is required.");
  }

  let notes: string | null = null;
  if (raw.notes != null) {
    if (typeof raw.notes !== "string") {
      throw new ReviewValidationError("Review notes must be text.");
    }
    notes = raw.notes.slice(0, 2000);
  }
  return { id, decision: raw.decision, reviewerId, notes };
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export interface ListApplicationsFilters {
  status?: ReviewDecision | "all" | string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicationListResult {
  applications: OnboardingApplication[];
  count: number;
}

export async function listApplications(
  filters: ListApplicationsFilters = {},
  deps: ReviewDeps = defaultDeps
): Promise<ApplicationListResult> {
  const where: string[] = [];
  const params: any[] = [];

  if (filters.status && filters.status !== "all") {
    if (!isReviewDecision(filters.status)) {
      throw new ReviewValidationError("Invalid review status filter.");
    }
    params.push(filters.status);
    where.push(`review_status = $${params.length}`);
  }
  if (typeof filters.q === "string" && filters.q.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(legal_name ILIKE $${params.length} OR display_name ILIKE $${params.length} ` +
        `OR contact_email ILIKE $${params.length})`
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = boundedInt(filters.limit, 20, 1, 200);
  const offset = boundedInt(filters.offset, 0, 0, 1_000_000);

  const rows = await deps.query(
    `SELECT * FROM partner_onboarding_application ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const countRows = await deps.query(
    `SELECT COUNT(*)::text AS count FROM partner_onboarding_application ${whereSql}`,
    params
  );
  return {
    applications: rows as OnboardingApplication[],
    count: Number(countRows[0]?.count ?? rows.length),
  };
}

export async function getApplication(
  id: string,
  deps: ReviewDeps = defaultDeps
): Promise<OnboardingApplication | null> {
  if (typeof id !== "string" || !id.trim() || id.length > 128) {
    throw new ReviewValidationError("A valid application id is required.");
  }
  const rows = await deps.query(
    "SELECT * FROM partner_onboarding_application WHERE id = $1 LIMIT 1",
    [id.trim()]
  );
  return (rows[0] as OnboardingApplication) ?? null;
}

/* ── Approval helpers ────────────────────────────────────────────────────── */

/** Display-name slug plus a short random suffix keeps partner slugs unique. */
export function buildPartnerSlug(displayName: string, suffix?: string): string {
  const base = slugify(displayName || "") || "partner";
  const short = (suffix ?? randomBytes(6).toString("hex")).slice(0, 8);
  return `${base}-${short}`.slice(0, 100);
}

/**
 * 24 random base64url characters with a recognisable prefix. It never touches
 * the database in plaintext — only `hashPassword(...)` is stored.
 */
function generateTemporaryPassword(): string {
  return `SvK-${randomBytes(18).toString("base64url")}`;
}

export interface ReviewResult {
  ok: true;
  application: OnboardingApplication;
  partnerId: string | null;
  /** Populated once, only on approval, for a one-time admin handoff. */
  temporaryPassword: string | null;
}

/**
 * Record an admin decision. On approval, the partner, its owner membership and
 * the application update are written in ONE transaction: a partial partner with
 * no owner (or an approved application with no partner) is never observable.
 */
export async function reviewApplication(
  input: ReviewInput,
  deps: ReviewDeps = defaultDeps
): Promise<ReviewResult> {
  const { id, decision, reviewerId, notes } = validateReviewInput(input);
  const now = deps.now ? deps.now() : new Date();
  const reviewedAt = now.toISOString();
  let temporaryPassword: string | null = null;

  const application = await deps.transaction(async (exec) => {
    // Lock the row so two concurrent approvals cannot create two partners.
    const locked = await exec(
      "SELECT * FROM partner_onboarding_application WHERE id = $1 FOR UPDATE",
      [id]
    );
    const app = locked[0] as OnboardingApplication | undefined;
    if (!app) throw new ApplicationNotFoundError();

    let partnerId: string | null = app.created_partner_id ?? null;

    if (decision === "approved") {
      if (app.review_status === "approved" || app.created_partner_id) {
        throw new AlreadyReviewedError();
      }

      temporaryPassword = generateTemporaryPassword();
      const passwordHash = hashPassword(temporaryPassword);
      const approvalHistory = [
        {
          decision: "approved",
          reviewer_id: reviewerId,
          reviewed_at: reviewedAt,
          ...(notes ? { notes } : {}),
        },
      ];

      // All identity fields come from the application. The admin confirms them;
      // nothing here invents a legal name, email or registration detail.
      const partnerRows = await exec(
        `INSERT INTO partner
           (legal_name, display_name, slug, contact_email, contact_phone,
            business_profile, account_status, verification_status,
            approval_history, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'active', 'unverified', $7::jsonb, $8, $8)
         RETURNING id`,
        [
          app.legal_name,
          app.display_name,
          buildPartnerSlug(app.display_name),
          app.contact_email,
          app.contact_phone,
          JSON.stringify(app.business_details ?? {}),
          JSON.stringify(approvalHistory),
          reviewedAt,
        ]
      );
      partnerId = partnerRows[0]?.id ?? null;
      if (!partnerId) throw new Error("Partner insert did not return an id.");

      await exec(
        `INSERT INTO partner_membership
           (partner_id, email, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'owner', 'invited', $4, $4)`,
        [partnerId, app.contact_email, passwordHash, reviewedAt]
      );
    }

    const updated = await exec(
      `UPDATE partner_onboarding_application
          SET review_status = $1, review_notes = $2, reviewed_by = $3,
              reviewed_at = $4, created_partner_id = COALESCE($5, created_partner_id),
              updated_at = $4
        WHERE id = $6
        RETURNING *`,
      [decision, notes, reviewerId, reviewedAt, partnerId, id]
    );
    return (updated[0] as OnboardingApplication) ?? app;
  });

  return {
    ok: true,
    application,
    partnerId: application.created_partner_id ?? null,
    temporaryPassword,
  };
}
