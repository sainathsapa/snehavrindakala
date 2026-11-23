/**
 * Admin catalogue approval workflow for partner product submissions.
 *
 * SERVER-ONLY. Every public function here is meant to be called from a guarded
 * route handler or Server Action that has already enforced
 * `requirePermission("products:read" | "products:write")`. Never import this
 * module from a client component.
 *
 * The reviewer identity is always supplied by the caller (derived from the
 * signed admin session) — it is never read from a request body here. Decisions
 * are limited to `approved` / `rejected`, and only a `submitted` product may be
 * reviewed. Rejection always carries a reason; approval clears any stale one.
 */

import { query as dbQuery } from "@/lib/db";

/** Minimal DB seam so the workflow is testable with a fake executor. */
export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export const SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const REVIEW_DECISIONS = ["approved", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ProductSubmission {
  id: string;
  partner_id: string;
  product_id: string;
  submission_status: SubmissionStatus;
  attributes: Record<string, unknown>;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** LEFT JOINed from `partner`, for admin readability only. */
  partner_display_name?: string | null;
}

/* ── Pure helpers ────────────────────────────────────────────────────────── */

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return (
    typeof value === "string" &&
    (SUBMISSION_STATUSES as readonly string[]).includes(value)
  );
}

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return (
    typeof value === "string" &&
    (REVIEW_DECISIONS as readonly string[]).includes(value)
  );
}

/**
 * The state machine guard. Only a product currently `submitted` for approval
 * can be reviewed; drafts and already-decided products are frozen.
 */
export function canReview(currentStatus: unknown): boolean {
  return currentStatus === "submitted";
}

/* ── Errors (callers map these to HTTP statuses / UI messages) ───────────── */

export class ProductApprovalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductApprovalValidationError";
  }
}

export class SubmissionNotFoundError extends Error {
  constructor(message = "Product submission not found.") {
    super(message);
    this.name = "SubmissionNotFoundError";
  }
}

export class NotReviewableError extends Error {
  constructor(message = "Only submitted products can be reviewed.") {
    super(message);
    this.name = "NotReviewableError";
  }
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

/**
 * List product submissions for the admin queue, optionally filtered by status.
 * `status` is always bound as a parameter — it is never interpolated into SQL.
 */
export async function listSubmissions(
  ex: QueryExecutor = dbQuery,
  status?: SubmissionStatus | "all" | string
): Promise<ProductSubmission[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (status && status !== "all") {
    if (!isSubmissionStatus(status)) {
      throw new ProductApprovalValidationError("Invalid submission status filter.");
    }
    params.push(status);
    where.push(`pp.submission_status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return (await ex(
    `SELECT pp.*, p.display_name AS partner_display_name
       FROM partner_product pp
       LEFT JOIN partner p ON p.id = pp.partner_id
       ${whereSql}
      ORDER BY pp.submitted_at DESC NULLS LAST, pp.created_at DESC
      LIMIT 200`,
    params
  )) as ProductSubmission[];
}

/** Fetch one submission. Used by the single-item admin API. */
export async function getSubmission(
  id: string,
  ex: QueryExecutor = dbQuery
): Promise<ProductSubmission | null> {
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!cleanId || cleanId.length > 128) {
    throw new ProductApprovalValidationError("A valid submission id is required.");
  }
  const rows = await ex(
    `SELECT pp.*, p.display_name AS partner_display_name
       FROM partner_product pp
       LEFT JOIN partner p ON p.id = pp.partner_id
      WHERE pp.id = $1 LIMIT 1`,
    [cleanId]
  );
  return (rows[0] as ProductSubmission) ?? null;
}

/* ── Review ──────────────────────────────────────────────────────────────── */

export interface ReviewSubmissionInput {
  decision: ReviewDecision;
  /** Required for a rejection; ignored for an approval. */
  reason?: string;
  /** Reviewer identity, derived from the signed admin session by the caller. */
  reviewer: string;
}

interface ValidatedReview {
  id: string;
  decision: ReviewDecision;
  reason: string | null;
  reviewer: string;
}

function validateReviewInput(id: unknown, input: unknown): ValidatedReview {
  if (!input || typeof input !== "object") {
    throw new ProductApprovalValidationError("Review input must be an object.");
  }
  const raw = input as Record<string, unknown>;

  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!cleanId || cleanId.length > 128) {
    throw new ProductApprovalValidationError("A valid submission id is required.");
  }
  if (!isReviewDecision(raw.decision)) {
    throw new ProductApprovalValidationError(
      "Invalid decision. Expected 'approved' or 'rejected'."
    );
  }
  const reviewer = typeof raw.reviewer === "string" ? raw.reviewer.trim() : "";
  if (!reviewer) {
    throw new ProductApprovalValidationError("A reviewer identity is required.");
  }

  let reason: string | null = null;
  if (raw.reason != null && typeof raw.reason !== "string") {
    throw new ProductApprovalValidationError("Rejection reason must be text.");
  }
  if (typeof raw.reason === "string" && raw.reason.trim()) {
    reason = raw.reason.trim().slice(0, 2000);
  }
  if (raw.decision === "rejected" && !reason) {
    throw new ProductApprovalValidationError(
      "A rejection reason is required."
    );
  }
  return { id: cleanId, decision: raw.decision, reason, reviewer };
}

export interface ReviewResult {
  ok: true;
  submission: ProductSubmission;
}

/**
 * Record an admin decision on a partner product submission.
 *
 * Validation happens before any query, so a bad decision or a missing rejection
 * reason never touches the database. The row is re-read by id and its status is
 * checked with the pure `canReview` guard. The update writes the decision, the
 * rejection reason (null on approval), and the reviewer audit fields together.
 */
export async function reviewSubmission(
  id: string,
  input: ReviewSubmissionInput,
  ex: QueryExecutor = dbQuery
): Promise<ReviewResult> {
  const { id: cleanId, decision, reason, reviewer } = validateReviewInput(id, input);
  const reviewedAt = new Date().toISOString();

  const currentRows = await ex(
    "SELECT * FROM partner_product WHERE id = $1 LIMIT 1 FOR UPDATE",
    [cleanId]
  );
  const current = currentRows[0] as ProductSubmission | undefined;
  if (!current) throw new SubmissionNotFoundError();
  if (!canReview(current.submission_status)) {
    throw new NotReviewableError(
      `Only submitted products can be reviewed (current status: ${current.submission_status}).`
    );
  }

  const updated = await ex(
    `UPDATE partner_product
        SET submission_status = $1, rejection_reason = $2,
            reviewed_by = $3, reviewed_at = $4, updated_at = $4
      WHERE id = $5
      RETURNING *`,
    [
      decision,
      decision === "rejected" ? reason : null,
      reviewer,
      reviewedAt,
      cleanId,
    ]
  );

  const submission =
    (updated[0] as ProductSubmission | undefined) ??
    ({
      ...current,
      submission_status: decision,
      rejection_reason: decision === "rejected" ? reason : null,
      reviewed_by: reviewer,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    } as ProductSubmission);

  return { ok: true, submission };
}
