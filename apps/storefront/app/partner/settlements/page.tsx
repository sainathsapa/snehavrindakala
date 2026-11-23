import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { tenantQuery } from "@/lib/partner/repository";
import { formatMoney } from "@/lib/partner-portal/statements";

export const metadata = {
  title: "Settlements — Partner portal — SnehaVrinda Kala",
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/partner/earnings", label: "Earnings" },
  { href: "/partner/statements", label: "Statements" },
  { href: "/partner/settlements", label: "Settlements" },
];

function FinanceNav({ active }: { active: string }) {
  return (
    <nav aria-label="Finance sections" className="mb-6 flex flex-wrap gap-2">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-sm font-sans ${
            item.href === active
              ? "border-sindoor bg-sindoor text-white"
              : "border-sand-border bg-surface text-deep-ink hover:border-sindoor"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Restricted() {
  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-5xl rounded-xl border border-sand-border bg-surface p-8">
        <h1 className="text-2xl font-serif font-semibold text-deep-ink">Access restricted</h1>
        <p className="mt-3 text-sm font-sans text-muted-ink">
          Your partner role does not include access to settlements. Contact your account owner if
          you believe this is a mistake.
        </p>
      </div>
    </main>
  );
}

type SettlementStatus =
  | "calculated"
  | "approved"
  | "payment_initiated"
  | "payment_completed"
  | "payment_failed";

interface SettlementRow {
  batch_id: string;
  status: SettlementStatus;
  period_start: string;
  period_end: string;
  currency: string;
  partner_amount: string | number;
  line_count: string | number;
  provider: string | null;
  payout_reference: string | null;
  failure_reason: string | null;
  item_id: string;
  ledger_entry_id: string;
}

interface SettlementBatchView {
  id: string;
  status: SettlementStatus;
  periodStart: string;
  periodEnd: string;
  currency: string;
  amount: number;
  itemCount: number;
  provider: string | null;
  payoutReference: string | null;
  failureReason: string | null;
}

const TIMELINE: Array<{ key: string; label: string }> = [
  { key: "calculated", label: "Calculated" },
  { key: "approved", label: "Approved" },
  { key: "payment_initiated", label: "Payment initiated" },
  { key: "payment_completed", label: "Payment completed" },
  { key: "failed", label: "Failed" },
];

function reachedIndex(status: SettlementStatus): number {
  switch (status) {
    case "calculated":
      return 0;
    case "approved":
      return 1;
    case "payment_initiated":
      return 2;
    case "payment_completed":
      return 3;
    case "payment_failed":
      return 4;
    default:
      return -1;
  }
}

function Timeline({ status }: { status: SettlementStatus }) {
  const reached = reachedIndex(status);
  const isFailed = status === "payment_failed";
  return (
    <ol className="mt-4 flex flex-wrap gap-x-2 gap-y-2" aria-label="Settlement status timeline">
      {TIMELINE.map((step, index) => {
        const active = isFailed ? step.key === "failed" : index <= reached;
        const current =
          (isFailed && step.key === "failed") ||
          (!isFailed && index === reached);
        return (
          <li
            key={step.key}
            aria-current={current ? "step" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-sans ${
              active
                ? current
                  ? "border-sindoor bg-sindoor text-white"
                  : "border-sindoor bg-surface text-deep-ink"
                : "border-sand-border bg-rang-paper text-muted-ink"
            }`}
          >
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

function groupByBatch(rows: SettlementRow[]): SettlementBatchView[] {
  const byId = new Map<string, SettlementBatchView>();
  for (const row of rows) {
    const existing = byId.get(row.batch_id);
    const amount = Number(row.partner_amount);
    if (existing) {
      existing.amount += Number.isFinite(amount) ? amount : 0;
      existing.itemCount += 1;
      continue;
    }
    byId.set(row.batch_id, {
      id: row.batch_id,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      currency: row.currency,
      amount: Number.isFinite(amount) ? amount : 0,
      itemCount: 1,
      provider: row.provider,
      payoutReference: row.payout_reference,
      failureReason: row.failure_reason,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export default async function PartnerSettlementsPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  if (!partnerHasPermission(ctx.role, "settlements:read")) return <Restricted />;

  // Tenant-scoped: the {partner} token is replaced with ctx.partnerId as a bound
  // parameter. The join is on this partner's settlement_batch_item rows, so a
  // batch is only visible when it contains at least one item for this partner,
  // and only this partner's item amounts are summed (never the batch's global
  // total, which would leak other partners' figures).
  const rows = await tenantQuery<SettlementRow>(
    ctx,
    "SELECT sb.id AS batch_id, sb.status, sb.period_start, sb.period_end, sb.currency, " +
      "sbi.amount AS partner_amount, sbi.id AS item_id, sbi.ledger_entry_id, " +
      "sb.provider, sb.payout_reference, sb.failure_reason " +
      "FROM settlement_batch_item sbi " +
      "JOIN settlement_batch sb ON sb.id = sbi.batch_id " +
      "WHERE sbi.partner_id = {partner} " +
      "ORDER BY sb.period_end DESC, sb.created_at DESC",
    []
  );

  const batches = groupByBatch(rows);

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
          Partner portal
        </p>
        <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">Settlements</h1>
        <p className="mt-2 text-sm font-sans text-muted-ink">
          Settlement batches that include your earnings. Read-only status tracking.
        </p>

        <div className="mt-6">
          <FinanceNav active="/partner/settlements" />
        </div>

        <section
          aria-label="Settlement notice"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-sans text-amber-900"
        >
          <p>
            <strong>No payout is executed from this portal.</strong> Approvals and payment runs are
            carried out only by authorized platform staff.
          </p>
          <p className="mt-2">
            A batch marked <strong>payment completed</strong> is only final once the payment
            provider has confirmed it. An internal status change alone does not mean money has
            reached your account.
          </p>
        </section>

        {batches.length === 0 ? (
          <section
            role="status"
            className="rounded-xl border border-sand-border bg-surface p-6 text-sm font-sans text-muted-ink"
          >
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              No settlement batches yet
            </h2>
            <p className="mt-2">
              No settlement batch currently contains your earnings. Earnings must first be
              recorded and a commission policy approved by a platform owner.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            {batches.map((batch) => (
              <article
                key={batch.id}
                className="rounded-xl border border-sand-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-serif font-semibold text-deep-ink">
                      Batch {batch.id.slice(0, 8)}
                    </h2>
                    <p className="mt-1 text-xs font-sans text-muted-ink">
                      Period {new Date(batch.periodStart).toISOString().slice(0, 10)} –{" "}
                      {new Date(batch.periodEnd).toISOString().slice(0, 10)} · {batch.itemCount}{" "}
                      {batch.itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-sans uppercase tracking-wide text-muted-ink">
                      Your amount
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-deep-ink">
                      {formatMoney(batch.amount, batch.currency)}
                    </p>
                  </div>
                </div>

                <Timeline status={batch.status} />

                {batch.status === "payment_completed" && (
                  <p className="mt-4 rounded-lg border border-sand-border bg-rang-paper p-3 text-xs font-sans text-muted-ink">
                    Provider confirmation is required before this batch is final. Provider:{" "}
                    {batch.provider || "not recorded"}
                    {batch.payout_reference ? ` · Reference: ${batch.payout_reference}` : ""}.
                  </p>
                )}
                {batch.status === "payment_failed" && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-sans text-red-800">
                    This batch failed. {batch.failureReason || "No reason was recorded."} No money
                    was confirmed as paid by the provider.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs font-sans text-muted-ink">
          Only your own batch items are shown. Statuses are informational and reflect what the
          platform has recorded; they are not an instruction or an action from this portal.
        </p>
      </div>
    </main>
  );
}
