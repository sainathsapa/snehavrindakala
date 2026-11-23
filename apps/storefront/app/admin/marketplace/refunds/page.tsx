/**
 * Refund execution — a read-only operations view of money actually moved.
 *
 * An internal approval in `order_refunds` is only permission to try; it does
 * NOT mean the customer has their money. Only a `refund_execution` row with
 * status `provider_confirmed` (and a provider refund id) means the provider
 * confirmed the refund. Dual control — the requester can never be the
 * approver — is enforced on the server by the CHECK constraint and by the
 * gated execute endpoint; this screen only reports that state.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import {
  moneyLabel,
  refundExecutionStatusLabel,
  whenLabel,
  type AwaitingApprovalRefund,
  type RefundExecutionRow,
} from "../../../api/admin/marketplace/finance/route";

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
            You do not have permission to view refund execution.
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function MarketplaceRefundsPage() {
  if (!(await canView())) return <AccessDenied />;

  let executions: RefundExecutionRow[] = [];
  let awaitingApproval: AwaitingApprovalRefund[] = [];
  let failed = false;
  try {
    [executions, awaitingApproval] = await Promise.all([
      query(
        `SELECT id, refund_request_id, order_id, amount, currency, status,
                requested_by, approved_by, provider, provider_refund_id,
                failure_reason, created_at
           FROM refund_execution
          ORDER BY created_at DESC
          LIMIT 200`
      ) as Promise<RefundExecutionRow[]>,
      query(
        `SELECT id, order_id, amount, reason, requested_by, created_at
           FROM order_refunds
          WHERE status = 'pending'
            AND requested_by IS NOT NULL
            AND approved_by IS NULL
          ORDER BY created_at ASC
          LIMIT 200`
      ) as Promise<AwaitingApprovalRefund[]>,
    ]);
  } catch (error) {
    console.error("Could not load marketplace refunds", error);
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
            Refund execution
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Read-only. This screen does not approve or release money.
          </p>
        </header>

        <div className="mb-6 rounded-xl border border-leaf/20 bg-leaf/5 p-6">
          <p className="font-sans text-sm font-semibold text-leaf">
            Only provider confirmation means money moved
          </p>
          <p className="mt-1 font-sans text-sm text-muted-ink">
            An internal <code className="font-mono text-xs">approved</code> status means we are
            allowed to try, not that the customer was paid. Only{" "}
            <code className="rounded bg-rang-paper px-1 py-0.5 font-mono text-xs">provider_confirmed</code>{" "}
            with a provider refund id means the provider confirmed the refund. Dual control is
            enforced on the server:{" "}
            <code className="font-mono text-xs">requested_by &lt;&gt; approved_by</code> — the person
            who asked for a refund can never be the person who approves or releases it. Neither
            name is taken from this screen or any request; both come from the stored approval and
            the signed-in identity.
          </p>
        </div>

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            Refund data could not be loaded. Please try again later.
          </div>
        )}

        <section className="mb-10">
          <h2 className="mb-3 font-serif text-xl font-semibold text-deep-ink">Provider executions</h2>
          <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-rang-paper/40">
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Execution</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Order</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Amount</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Requested by / approved by</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {executions.length ? (
                  executions.map((execution) => (
                    <tr key={execution.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        <span className="font-mono text-xs text-muted-ink">{execution.id.slice(-8)}</span>
                        {execution.provider_refund_id && (
                          <span className="mt-1 block font-mono text-xs text-muted-ink">
                            provider {execution.provider_refund_id.slice(-12)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">{execution.order_id}</td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {moneyLabel(execution.amount, execution.currency)}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm">
                        <span className={
                          execution.status === "provider_confirmed" ? "text-leaf" : "text-muted-ink"
                        }>
                          {refundExecutionStatusLabel(execution.status)}
                        </span>
                        {execution.failure_reason && (
                          <span className="mt-1 block text-xs italic text-sindoor">
                            {execution.failure_reason}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {execution.requested_by} / {execution.approved_by}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {whenLabel(execution.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="font-sans text-sm text-muted-ink">
                        {failed ? "Refund data is unavailable right now." : "No provider executions yet."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-semibold text-deep-ink">
            Awaiting two-person approval
          </h2>
          <p className="mb-3 font-sans text-sm text-muted-ink">
            These internal requests are not yet decided. A second, different admin must approve
            one before it can even be sent to the provider.
          </p>
          <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-rang-paper/40">
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Request</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Order</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Amount</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Requested by</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {awaitingApproval.length ? (
                  awaitingApproval.map((refund) => (
                    <tr key={refund.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        <span className="font-mono text-xs text-muted-ink">{refund.id.slice(-8)}</span>
                        <span className="mt-1 block text-xs text-muted-ink">{whenLabel(refund.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">{refund.order_id}</td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {moneyLabel(refund.amount)}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {refund.requested_by ?? "unknown admin"}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {refund.reason || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="font-sans text-sm text-muted-ink">
                        {failed ? "Refund data is unavailable right now." : "Nothing is awaiting a second signature."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
