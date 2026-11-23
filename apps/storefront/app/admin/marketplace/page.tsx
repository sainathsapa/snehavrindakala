/**
 * Admin marketplace overview — a single operational view across every tenant.
 *
 * Server-rendered with platform-wide data (never partner-scoped). Access is
 * gated on an explicit `partners:read` permission; a partner-scoped admin role
 * is refused so this page can never leak one tenant's data into another.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { getMarketplaceOverview } from "@/lib/admin-marketplace/overview";

export const dynamic = "force-dynamic";

async function canView(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("partners:read");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">
            Not available
          </h1>
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
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const tiles = [
  { label: "Partners", value: (s: any) => s.totalPartners, href: "/admin/marketplace/partners" },
  { label: "Active partners", value: (s: any) => s.activePartners, href: "/admin/marketplace/partners" },
  { label: "Verified partners", value: (s: any) => s.verifiedPartners, href: "/admin/marketplace/partners" },
  { label: "Awaiting acceptance", value: (s: any) => s.awaitingAcceptance, href: "/admin/marketplace/allocations" },
  { label: "Fulfilment groups", value: (s: any) => s.totalAllocations, href: "/admin/marketplace/allocations" },
  { label: "Settlement batches", value: (s: any) => s.settlementsCount, href: "/admin/marketplace/settlements" },
];

export default async function MarketplaceOverviewPage() {
  if (!(await canView())) return <AccessDenied />;

  let overview: Awaited<ReturnType<typeof getMarketplaceOverview>> | null = null;
  let failed = false;
  try {
    overview = await getMarketplaceOverview();
  } catch (error) {
    console.error("Could not load the marketplace overview", error);
    failed = true;
  }

  const summary = overview?.summary;
  const tileValues = summary
    ? { ...summary, settlementsCount: overview?.settlements.length ?? 0 }
    : null;

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Marketplace
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm text-muted-ink">
            One operational view across every partner, allocation and settlement.
            Platform data only — partner sessions never reach these queries.
          </p>
          <nav className="mt-4 flex flex-wrap gap-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace/partners" className="hover:underline">
              Partners →
            </Link>
            <Link href="/admin/marketplace/allocations" className="hover:underline">
              Allocations →
            </Link>
            <Link href="/admin/marketplace/settlements" className="hover:underline">
              Settlements →
            </Link>
          </nav>
        </header>

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            The marketplace data could not be loaded. Please try again later.
          </div>
        )}

        {tileValues && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="rounded-xl border border-sand-border bg-surface p-5 transition-colors hover:border-sindoor"
              >
                <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  {tile.label}
                </p>
                <p className="mt-2 font-serif text-2xl font-semibold text-deep-ink">
                  {tile.value(tileValues)}
                </p>
              </Link>
            ))}
          </div>
        )}

        {summary && (
          <div className="mt-4 rounded-xl border border-sand-border bg-surface p-6">
            <p className="font-sans text-sm text-muted-ink">
              Net payable across {summary.totalEarningsEntries} ledger entries:{" "}
              <span className="font-medium text-deep-ink">
                {money(summary.totalPayable, summary.currency)}
              </span>
              . Commission recorded: {money(summary.totalCommission, summary.currency)}.
            </p>
          </div>
        )}

        {overview && (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Partner table */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-deep-ink">Partners</h2>
                <Link href="/admin/marketplace/partners" className="font-sans text-sm text-sindoor hover:underline">
                  View all
                </Link>
              </div>
              <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-rang-paper/40">
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Partner</th>
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-border">
                    {overview.partners.length ? (
                      overview.partners.slice(0, 8).map((partner) => (
                        <tr key={partner.id} className="hover:bg-rang-paper/50">
                          <td className="px-4 py-3 font-sans text-sm text-deep-ink">
                            {partner.display_name}
                            {partner.artist_name && (
                              <span className="block text-xs text-muted-ink">
                                Maker: {partner.artist_name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-sans text-sm text-muted-ink">{partner.account_status}</td>
                          <td className="px-4 py-3 font-sans text-sm text-muted-ink">{partner.verification_status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center font-sans text-sm text-muted-ink">
                          No partners yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Allocation queue */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-deep-ink">Allocation queue</h2>
                <Link href="/admin/marketplace/allocations" className="font-sans text-sm text-sindoor hover:underline">
                  View all
                </Link>
              </div>
              <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-rang-paper/40">
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Group</th>
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Partner</th>
                      <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-border">
                    {overview.allocations.length ? (
                      overview.allocations.slice(0, 8).map((group) => (
                        <tr key={group.id} className="hover:bg-rang-paper/50">
                          <td className="px-4 py-3 font-sans text-sm text-deep-ink">
                            #{group.customer_order_id.slice(-8)}
                          </td>
                          <td className="px-4 py-3 font-sans text-sm text-muted-ink">
                            {group.partner_name ?? group.partner_id.slice(-8)}
                          </td>
                          <td className="px-4 py-3 font-sans text-sm text-muted-ink">{group.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center font-sans text-sm text-muted-ink">
                          No fulfilment groups yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {overview && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-deep-ink">Settlements</h2>
              <Link href="/admin/marketplace/settlements" className="font-sans text-sm text-sindoor hover:underline">
                View all
              </Link>
            </div>
            <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-rang-paper/40">
                    <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Batch</th>
                    <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Period</th>
                    <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Amount</th>
                    <th className="px-4 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {overview.settlements.length ? (
                    overview.settlements.map((batch) => (
                      <tr key={batch.id} className="hover:bg-rang-paper/50">
                        <td className="px-4 py-3 font-sans text-sm text-deep-ink">#{batch.id.slice(-8)}</td>
                        <td className="px-4 py-3 font-sans text-sm text-muted-ink">
                          {when(batch.period_start)} – {when(batch.period_end)}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm text-deep-ink">
                          {money(batch.total_amount, batch.currency)}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm text-muted-ink">{batch.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center font-sans text-sm text-muted-ink">
                        No settlement batches yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
