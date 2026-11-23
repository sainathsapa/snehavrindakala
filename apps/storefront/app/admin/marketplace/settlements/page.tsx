/**
 * Settlement batches — the lifecycle status of each payout batch across the
 * platform. No payout is initiated here; this is a read-only operational view.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { listSettlements } from "@/lib/admin-marketplace/overview";

export const dynamic = "force-dynamic";

async function canView(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("partners:read");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">Not available</h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            You do not have permission to view the platform marketplace.
          </p>
        </div>
      </div>
    </main>
  );
}

function money(value: string | number, currency: string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "INR").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
}

function when(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MarketplaceSettlementsPage() {
  if (!(await canView())) return <AccessDenied />;

  let batches: Awaited<ReturnType<typeof listSettlements>> = [];
  let failed = false;
  try {
    batches = await listSettlements();
  } catch (error) {
    console.error("Could not load marketplace settlements", error);
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
            Settlement batches
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Read-only lifecycle view. A batch is only paid once its status is
            payment_completed with a provider confirmation.
          </p>
        </header>

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            The settlement list could not be loaded. Please try again later.
          </div>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-rang-paper/40">
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Batch</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Period</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Lines</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Amount</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {batches.length ? (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">#{batch.id.slice(-8)}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {when(batch.period_start)} – {when(batch.period_end)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{batch.line_count}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {money(batch.total_amount, batch.currency)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{batch.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="font-sans text-sm text-muted-ink">
                      {failed ? "Settlement data is unavailable right now." : "No settlement batches found."}
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
