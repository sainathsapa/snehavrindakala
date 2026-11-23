/**
 * Dedicated "Product submissions" history view for the partner portal.
 *
 * This module deliberately owns NO product data access of its own. Every read
 * goes through the A25 catalogue module (`./products`), whose functions use
 * `tenantQuery(ctx, ...)` with a literal `{partner}` predicate. The tenant can
 * therefore only come from the verified server-side `PartnerContext` — there is
 * no parameter anywhere in this module through which a client-supplied partner
 * id could reach a query.
 *
 * On top of those scoped reads this module adds one pure helper,
 * `buildSubmissionTimeline(product)`, which turns the status fields + dates on
 * a `partner_product` row into a friendly, chronologically ordered history.
 */

import type { PartnerContext } from "@/lib/partner/types";
import type { QueryExecutor } from "@/lib/partner/repository";
import {
  getProduct,
  listProducts,
  readProductDetails,
  type PartnerProductRow,
  type SubmissionStatus,
} from "./products";

/** The lifecycle states shown in a submission's history. */
export type SubmissionTimelineStatus = SubmissionStatus;

export interface SubmissionTimelineEvent {
  /** Stable key for the event (also used as a React key). */
  id: "created" | "submitted" | "decision";
  status: SubmissionTimelineStatus;
  /** Short human label, e.g. "Submitted for review". */
  label: string;
  /** Friendly sentence describing what happened. */
  description: string;
  /** Raw ISO timestamp from the row; null when the row has no such date. */
  at: string | null;
  /** Present only on a rejection decision — the reviewer's reason. */
  reason?: string;
}

export interface SubmissionTimeline {
  /** The submission row id (safe shortened form is used in the UI). */
  submissionId: string;
  /** The product reference stored on the submission (real or pending:…). */
  productId: string;
  /** Human title from the A25 `attributes` payload. */
  title: string;
  /** Current status straight from the scoped row. */
  currentStatus: SubmissionStatus;
  /** Current rejection reason straight from the scoped row (null when none). */
  rejectionReason: string | null;
  /** Chronologically ordered history, earliest event first. */
  events: SubmissionTimelineEvent[];
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft created",
  submitted: "Submitted for review",
  approved: "Approved",
  rejected: "Changes requested",
};

/** Date ordering: rows with no/unparseable date sort to the end, preserving input order. */
function timestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Pure mapping from one scoped `partner_product` row to a friendly, ordered
 * history. No I/O, no mutation of the input row, and no partner id involved.
 *
 * A decision event is only emitted for a terminal review state (approved or
 * rejected) that has a `reviewed_at`. A resubmission clears the rejection and
 * sets a new `submitted_at`, so a stale `reviewed_at` on a `submitted` row is
 * intentionally not shown as a decision for the current round.
 */
export function buildSubmissionTimeline(product: PartnerProductRow): SubmissionTimeline {
  const details = readProductDetails(product);
  // Internal sequence keeps events stable when two timestamps are equal or absent.
  const ordered: Array<{ seq: number; event: SubmissionTimelineEvent }> = [
    {
      seq: 0,
      event: {
        id: "created",
        status: "draft",
        label: STATUS_LABEL.draft,
        description: "Your draft submission was created. You can edit it before sending it for review.",
        at: product.created_at ?? null,
      },
    },
  ];

  if (product.submitted_at) {
    ordered.push({
      seq: 1,
      event: {
        id: "submitted",
        status: "submitted",
        label: STATUS_LABEL.submitted,
        description: "You sent this submission to the SnehaVrinda Kala team for review.",
        at: product.submitted_at,
      },
    });
  }

  if (
    product.reviewed_at &&
    (product.submission_status === "approved" || product.submission_status === "rejected")
  ) {
    const rejectionReason =
      product.submission_status === "rejected" && product.rejection_reason
        ? product.rejection_reason.trim()
        : "";
    ordered.push({
      seq: 2,
      event: {
        id: "decision",
        status: product.submission_status,
        label: STATUS_LABEL[product.submission_status],
        description:
          product.submission_status === "rejected"
            ? rejectionReason
              ? `The team requested changes: ${rejectionReason}`
              : "The team requested changes to this submission."
            : "The team approved this submission.",
        at: product.reviewed_at,
        ...(product.submission_status === "rejected" && rejectionReason
          ? { reason: rejectionReason }
          : {}),
      },
    });
  }

  ordered.sort((a, b) => {
    const byTime = timestamp(a.event.at) - timestamp(b.event.at);
    return Number.isNaN(byTime) ? a.seq - b.seq : byTime || a.seq - b.seq;
  });

  return {
    submissionId: product.id,
    productId: product.product_id,
    title: details.title,
    currentStatus: product.submission_status,
    rejectionReason: product.rejection_reason ?? null,
    events: ordered.map(({ event }) => event),
  };
}

/* ── Scoped reads (delegated to A25; no duplicate product access) ─────────── */

/**
 * Timelines for every submission owned by the session partner. `listProducts`
 * is A25's `tenantQuery`-scoped read, so rows from another tenant cannot appear.
 */
export async function listSubmissionTimelines(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<SubmissionTimeline[]> {
  const rows = await listProducts(ctx, ex);
  return rows.map(buildSubmissionTimeline);
}

/**
 * A single submission's timeline, returned only when the row belongs to `ctx`.
 * Uses A25's scoped `getProduct`; a known/guessed foreign id yields null.
 */
export async function getSubmissionTimeline(
  ctx: PartnerContext,
  submissionId: string,
  ex?: QueryExecutor
): Promise<SubmissionTimeline | null> {
  const row = await getProduct(ctx, submissionId, ex);
  return row ? buildSubmissionTimeline(row) : null;
}
