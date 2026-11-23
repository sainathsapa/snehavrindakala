/**
 * Admin catalogue approvals for partner product submissions.
 *
 * Server Component: read access is gated by `products:read`, rows come straight
 * from the `partner_product` table through the approval lib (no seed/mock data),
 * and the approve/reject controls are Server Actions that enforce
 * `products:write`. The reviewer is derived from the signed admin session.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  canReview,
  isReviewDecision,
  listSubmissions,
  reviewSubmission,
  type ProductSubmission,
} from "@/lib/admin-marketplace/product-approvals";

export const dynamic = "force-dynamic";

const PAGE_PATH = "/admin/marketplace/product-approvals";

/** Approve/reject a submission. The decision and reason come from the form; the
 * reviewer identity is taken from the session, never from the form. */
async function reviewAction(formData: FormData) {
  "use server";

  if (!(await requirePermission("products:write"))) redirect("/admin/login");
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");

  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const reason = String(formData.get("reason") || "");

  if (!isReviewDecision(decision)) {
    redirect(`${PAGE_PATH}?error=${encodeURIComponent("Invalid decision.")}`);
  }

  let error: string | null = null;
  try {
    await reviewSubmission(id, { decision, reason, reviewer: identity.email });
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not record this review.";
  }

  revalidatePath(PAGE_PATH);
  if (error) redirect(`${PAGE_PATH}?error=${encodeURIComponent(error)}`);
  redirect(`${PAGE_PATH}?ok=1`);
}

function statusClass(status: string): string {
  switch (status) {
    case "submitted":
      return "bg-terracotta/10 text-terracotta border border-terracotta/20";
    case "approved":
      return "bg-leaf/10 text-leaf border border-leaf/20";
    case "rejected":
      return "bg-sindoor/10 text-sindoor border border-sindoor/20";
    default:
      return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium font-sans ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN");
}

export default async function ProductApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!(await requirePermission("products:read"))) redirect("/admin/login");

  const params = await searchParams;
  let submissions: ProductSubmission[] = [];
  let loadError: string | null = null;
  try {
    submissions = await listSubmissions();
  } catch (err) {
    console.error("Could not read partner product submissions", err);
    loadError = "Submissions could not be read right now.";
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Product Approvals
          </h1>
          <p className="text-muted-ink font-sans">
            Review catalogue products submitted by marketplace partners.
          </p>
        </div>

        {params.ok && (
          <p
            role="status"
            className="mb-6 rounded-md border border-leaf/20 bg-leaf/10 p-3 font-sans text-sm text-leaf"
          >
            Decision recorded.
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-sindoor/20 bg-sindoor/10 p-3 font-sans text-sm text-sindoor"
          >
            {params.error}
          </p>
        )}
        {loadError && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-sindoor/20 bg-sindoor/10 p-3 font-sans text-sm text-sindoor"
          >
            {loadError}
          </p>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-x-auto">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                {[
                  "Submission",
                  "Partner",
                  "Product",
                  "Status",
                  "Submitted",
                  "Review",
                  "Decision",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No product submissions yet.
                    </p>
                  </td>
                </tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-rang-paper/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-deep-ink">
                      #{s.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {s.partner_display_name || "—"}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      <span>{s.product_id}</span>
                      {s.rejection_reason && (
                        <span className="mt-1 block text-xs text-sindoor">
                          Reason: {s.rejection_reason}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm">
                      <StatusBadge status={s.submission_status} />
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {formatDate(s.submitted_at)}
                    </td>
                    <td className="px-6 py-4 font-sans text-xs text-muted-ink">
                      {s.reviewed_by ? (
                        <>
                          <span className="block text-deep-ink">{s.reviewed_by}</span>
                          <span className="block">{formatDate(s.reviewed_at)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm">
                      {canReview(s.submission_status) ? (
                        <form action={reviewAction} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="text"
                            name="reason"
                            placeholder="Rejection reason (required to reject)"
                            aria-label={`Rejection reason for submission ${s.id}`}
                            className="w-full px-3 py-2 rounded-md border border-sand-border bg-white text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              name="decision"
                              value="approved"
                              className="rounded-md bg-leaf px-3 py-1.5 text-sm font-sans font-medium text-white hover:bg-leaf/90 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="rejected"
                              className="rounded-md border border-terracotta px-3 py-1.5 text-sm font-sans font-medium text-terracotta hover:bg-terracotta/10 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-ink">
                          Reviewed — no action available
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
