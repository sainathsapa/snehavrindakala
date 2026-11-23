/**
 * Allocation queue — fulfilment groups across every customer order.
 * Groups still in `assigned` (handed over, not yet accepted) sort first.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { listAllocations } from "@/lib/admin-marketplace/overview";

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

function when(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MarketplaceAllocationsPage() {
  if (!(await canView())) return <AccessDenied />;

  let groups: Awaited<ReturnType<typeof listAllocations>> = [];
  let failed = false;
  try {
    groups = await listAllocations();
  } catch (error) {
    console.error("Could not load marketplace allocations", error);
    failed = true;
  }

  const awaiting = groups.filter((g) => g.status === "assigned").length;

  return (
    <main className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <nav className="mb-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace" className="hover:underline">← Marketplace</Link>
          </nav>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Allocation queue
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Every partner fulfilment group. {awaiting} awaiting partner acceptance.
          </p>
        </header>

        {failed && (
          <div className="mb-6 rounded-xl border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
            The allocation queue could not be loaded. Please try again later.
          </div>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-rang-paper/40">
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Order</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Partner</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Deadline</th>
                <th className="px-6 py-4 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {groups.length ? (
                groups.map((group) => (
                  <tr key={group.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      #{group.customer_order_id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {group.partner_name ?? group.partner_id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm">
                      <span
                        className={
                          group.status === "assigned"
                            ? "text-sindoor font-medium"
                            : "text-deep-ink"
                        }
                      >
                        {group.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{when(group.fulfilment_deadline)}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{when(group.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="font-sans text-sm text-muted-ink">
                      {failed ? "Allocation data is unavailable right now." : "No fulfilment groups found."}
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
