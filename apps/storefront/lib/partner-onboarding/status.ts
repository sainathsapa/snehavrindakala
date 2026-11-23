/**
 * Public-facing status lookup for a partner onboarding application.
 *
 * The application `id` is the opaque reference handed to the applicant at
 * submission time. It is used ONLY as a lookup key for that application row —
 * it is not a partner/tenant id and never grants access to any other tenant's
 * data. The SELECT is allow-listed so contact details, documents, reviewer
 * identity and other PII can never reach a public caller.
 */

import { query as dbQuery } from "@/lib/db";

/** Injectable DB boundary so the lookup can be tested with a fake. */
export type StatusExecutor = (sql: string, params?: any[]) => Promise<any[]>;

/** The four decisions an admin can record during review. */
export type ReviewStatus = "pending" | "more_info" | "approved" | "rejected";

/**
 * The only application fields safe to expose publicly. `review_notes` holds the
 * applicant-facing explanation of a decision (never the reviewer's identity).
 */
export interface ApplicationStatus {
  id: string;
  display_name: string;
  review_status: ReviewStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  created_partner_id: string | null;
}

/** Allow-listed public fields, shared by the route and the test suite. */
export const PUBLIC_STATUS_FIELDS = [
  "id",
  "display_name",
  "review_status",
  "review_notes",
  "reviewed_at",
  "created_at",
  "created_partner_id",
] as const;

const DEFAULT_EXECUTOR: StatusExecutor = (sql, params = []) => dbQuery(sql, params);

/**
 * Look up an application by its public reference id.
 *
 * Returns `null` for an unknown/blank id rather than throwing, so callers can
 * map the result directly to a 404. Only the seven allow-listed columns are
 * selected and projected, which keeps secrets and PII out of the response even
 * if the underlying table gains new columns later.
 */
export async function getApplicationStatus(
  id: unknown,
  ex: StatusExecutor = DEFAULT_EXECUTOR
): Promise<ApplicationStatus | null> {
  if (typeof id !== "string" || id.trim().length === 0) return null;

  const rows = await ex(
    `SELECT id, display_name, review_status, review_notes, reviewed_at,
            created_at, created_partner_id
       FROM partner_onboarding_application
      WHERE id = $1
      LIMIT 1`,
    [id.trim()]
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    display_name: row.display_name,
    review_status: row.review_status,
    review_notes: row.review_notes ?? null,
    reviewed_at: row.reviewed_at ?? null,
    created_at: row.created_at,
    created_partner_id: row.created_partner_id ?? null,
  };
}

/**
 * Pure, friendly copy for a review status. For `more_info` and `rejected` the
 * applicant-facing review note is included as the reason; reviewers' identity
 * is never part of this message.
 */
export function statusMessage(
  status: ReviewStatus | string | null | undefined,
  notes?: string | null
): string {
  const reason = typeof notes === "string" ? notes.trim() : "";

  switch (status) {
    case "pending":
      return "Your application is in our review queue. We'll update this page as soon as we have news — thank you for your patience.";
    case "more_info":
      return reason
        ? `We need a little more information before we can continue: ${reason}`
        : "We need a little more information before we can continue. Our team will be in touch with the details.";
    case "approved":
      return "Congratulations — your application has been approved! A member of our team will be in touch with the next steps to set up your partner account.";
    case "rejected":
      return reason
        ? `We weren't able to approve this application at this time. ${reason}`
        : "We weren't able to approve this application at this time. If you believe this is a mistake, please get in touch with our team.";
    default:
      return "We're updating your application status. Please check back shortly.";
  }
}
