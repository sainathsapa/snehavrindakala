import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { getPartnerEarnings } from "@/lib/partner/repository";
import { formatMoney } from "@/lib/partner-portal/statements";

export const metadata = {
  title: "Earnings — Partner portal — SnehaVrinda Kala",
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
          Your partner role does not include access to earnings. Contact your account owner if
          you believe this is a mistake.
        </p>
      </div>
    </main>
  );
}

export default async function PartnerEarningsPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  if (!partnerHasPermission(ctx.role, "earnings:read")) return <Restricted />;

  // Tenant-scoped by contract: getPartnerEarnings binds ctx.partnerId and there
  // is no way for this page to supply a different partner id.
  const entries = await getPartnerEarnings(ctx);

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
          Partner portal
        </p>
        <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">Earnings</h1>
        <p className="mt-2 text-sm font-sans text-muted-ink">
          Read-only ledger of commission earned on your items. Signed in as {ctx.email}.
        </p>

        <div className="mt-6">
          <FinanceNav active="/partner/earnings" />
        </div>

        {entries.length === 0 ? (
          <section
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm font-sans text-amber-900"
          >
            <h2 className="text-lg font-serif font-semibold">No earnings recorded yet</h2>
            <p className="mt-2">
              There are no earnings ledger entries for your account. This usually means no
              commission policy has been configured and approved for your account yet — a
              platform owner must set that up before earnings can be calculated. The policy
              configuration is <strong>UNCONFIGURED</strong> from your point of view; no rates or
              payout terms are asserted here.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-sand-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm font-sans">
                <thead className="bg-rang-paper text-xs uppercase tracking-wide text-muted-ink">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type / Status</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Payable</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 font-medium text-deep-ink">{entry.order_id}</td>
                      <td className="px-4 py-3 text-deep-ink">{entry.item_id}</td>
                      <td className="px-4 py-3 text-muted-ink">{entry.entry_type}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(entry.gross_basis, entry.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(entry.commission_amount, entry.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-deep-ink">
                        {formatMoney(entry.payable_amount, entry.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-ink">
                        {entry.created_at
                          ? new Date(entry.created_at).toISOString().slice(0, 10)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="mt-6 text-xs font-sans text-muted-ink">
          This is a read-only view. Approvals, settlement calculation and payouts are performed
          only by authorized platform staff — nothing can be approved or paid from this portal.
        </p>
      </div>
    </main>
  );
}
