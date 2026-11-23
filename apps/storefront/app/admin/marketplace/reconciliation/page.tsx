/**
 * Payment reconciliation queue — a read-only operational view.
 *
 * Issues are opened and worked by the scheduled reconciler at
 * `/api/cron/reconcile-payments`, never by anything on this screen. This page
 * only shows state, including why an issue is still waiting and when the next
 * attempt is due. If sandbox credentials are missing it says so loudly: without
 * them the reconciler can report a mismatch but cannot verify with the provider.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import {
  issueTypeLabel,
  reconciliationStatusLabel,
  sandboxPaymentConfig,
  whenLabel,
  type ReconciliationIssueRow,
} from "@/lib/admin/finance-view";

export const dynamic = "force-dynamic";

async function canView(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("refunds:read");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">Not available</h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            You do not have permission to view payment reconciliation.
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function ReconciliationPage() {
  if (!(await canView())) return <AccessDenied />;

  const config = sandboxPaymentConfig();
  let issues: ReconciliationIssueRow[] = [];
  let failed = false;
  try {
    issues = (await query(
      `SELECT id, order_id, payment_id, issue_type, status, attempts,
              next_attempt_at, last_error
         FROM payment_reconciliation_issue
        ORDER BY next_attempt_at ASC, created_at ASC
        LIMIT 200`
    )) as ReconciliationIssueRow[];
  } catch (error) {
    console.error("Could not load reconciliation issues", error);
    failed = true;
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <nav className="mb-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace" className="hover:underline">← Marketplace</Link>
          </nav>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Payment reconciliation
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Read-only queue of payments the provider and our orders disagree about.
            The scheduled job at <code className="rounded bg-rang-paper px-1 py-0.5 font-mono text-xs">/api/cron/reconcile-payments</code>{" "}
            verifies with the provider and updates these rows; nothing here changes state.
          </p>
        </header>

        {!config.configured && (
          <div role="alert" className="mb-6 rounded-xl border border-sindoor/30 bg-sindoor/5 p-6">
            <p className="font-sans text-sm font-semibold text-sindoor">
              Sandbox payment credentials are not configured
            </p>
            <p className="mt-1 font-sans text-sm text-muted-ink">
              Reconciliation can list mismatches but cannot verify them with the provider until
              these are set: {config.missing.length ? config.missing.join(", ") : "the Payments configuration group"}.
              Only names are shown here — values are never displayed.
            </p>
          </div>
        )}

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            The reconciliation queue could not be loaded. Please try again later.
          </div>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-rang-paper/40">
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Issue</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Order</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Type</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Attempts</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Next attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {issues.length ? (
                issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      <span className="font-mono text-xs text-muted-ink">{issue.id.slice(-8)}</span>
                      {issue.payment_id && (
                        <span className="mt-1 block font-mono text-xs text-muted-ink">
                          payment {issue.payment_id.slice(-10)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{issue.order_id}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {issueTypeLabel(issue.issue_type)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {reconciliationStatusLabel(issue.status)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{issue.attempts}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {whenLabel(issue.next_attempt_at)}
                      {issue.last_error && (
                        <span className="mt-1 block text-xs italic text-sindoor" title={issue.last_error}>
                          last error: {issue.last_error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="font-sans text-sm text-muted-ink">
                      {failed ? "Reconciliation data is unavailable right now." : "No open reconciliation issues."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
