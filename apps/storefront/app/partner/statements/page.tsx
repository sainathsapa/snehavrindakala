import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { getPartnerEarnings } from "@/lib/partner/repository";
import {
  buildStatement,
  formatMoney,
  groupEntriesIntoPeriods,
  type EarningsEntry,
} from "@/lib/partner-portal/statements";

export const metadata = {
  title: "Statements — Partner portal — SnehaVrinda Kala",
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
          Your partner role does not include access to statements. Contact your account owner if
          you believe this is a mistake.
        </p>
      </div>
    </main>
  );
}

export default async function PartnerStatementsPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  if (!partnerHasPermission(ctx.role, "statements:read")) return <Restricted />;

  // Always start from the tenant-scoped ledger read; grouping is a pure view
  // operation over rows that already belong to this partner.
  const rows = (await getPartnerEarnings(ctx)) as EarningsEntry[];
  const statements = groupEntriesIntoPeriods(rows).map((group) =>
    buildStatement(group.entries, group.period)
  );

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
          Partner portal
        </p>
        <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">Statements</h1>
        <p className="mt-2 text-sm font-sans text-muted-ink">
          Your earnings grouped by settlement batch or period. Read-only — no file is generated
          or downloaded.
        </p>

        <div className="mt-6">
          <FinanceNav active="/partner/statements" />
        </div>

        <section
          aria-label="Statement view notice"
          className="mb-6 rounded-lg border border-sand-border bg-surface p-4 text-sm font-sans text-muted-ink"
        >
          <span className="font-medium text-deep-ink">Statement view.</span> These statements are
          an on-screen view of your own ledger only. They are clearly labelled as informational,
          are not issued tax or payment documents, and contain no downloadable/export action.
        </section>

        {statements.length === 0 ? (
          <section
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm font-sans text-amber-900"
          >
            <h2 className="text-lg font-serif font-semibold">No statements available yet</h2>
            <p className="mt-2">
              There are no ledger entries to group into a statement. A commission policy must
              first be configured and approved by a platform owner. Policy configuration is{" "}
              <strong>UNCONFIGURED</strong> for your account; no rates or payout terms are assumed.
            </p>
          </section>
        ) : (
          <div className="space-y-8">
            {statements.map((statement) => (
              <article
                key={statement.period.key}
                className="overflow-hidden rounded-xl border border-sand-border bg-surface"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-sand-border bg-rang-paper px-5 py-4">
                  <div>
                    <h2 className="text-xl font-serif font-semibold text-deep-ink">
                      {statement.period.label}
                    </h2>
                    <p className="mt-1 text-xs font-sans text-muted-ink">
                      {statement.period.batchId
                        ? `Batch ${statement.period.batchId}`
                        : "Grouped by month"}
                    </p>
                  </div>
                  <span className="rounded-full border border-sand-border bg-surface px-3 py-1 text-xs font-sans text-muted-ink">
                    {statement.viewLabel}
                  </span>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm font-sans">
                    <thead className="text-xs uppercase tracking-wide text-muted-ink">
                      <tr>
                        <th className="px-5 py-3">Order</th>
                        <th className="px-5 py-3">Item</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Gross</th>
                        <th className="px-5 py-3 text-right">Commission</th>
                        <th className="px-5 py-3 text-right">Payable</th>
                        <th className="px-5 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-border">
                      {statement.lineItems.map((line) => (
                        <tr key={line.entryId}>
                          <td className="px-5 py-3 font-medium text-deep-ink">{line.orderId}</td>
                          <td className="px-5 py-3 text-deep-ink">{line.itemId}</td>
                          <td className="px-5 py-3 text-muted-ink">{line.status}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatMoney(line.gross, statement.currency)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatMoney(line.commission, statement.currency)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatMoney(line.payable, statement.currency)}
                          </td>
                          <td className="px-5 py-3 text-muted-ink">{line.date}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-sand-border bg-rang-paper font-medium text-deep-ink">
                      <tr>
                        <td className="px-5 py-3" colSpan={3}>
                          Totals · {statement.totals.lineCount}{" "}
                          {statement.totals.lineCount === 1 ? "entry" : "entries"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatMoney(statement.totals.gross, statement.currency)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatMoney(statement.totals.commission, statement.currency)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatMoney(statement.totals.payable, statement.currency)}
                        </td>
                        <td className="px-5 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs font-sans text-muted-ink">
          Statements are informational only. Approval and payout happen exclusively on the
          platform side; this portal executes no payment.
        </p>
      </div>
    </main>
  );
}
