/**
 * Partner overview dashboard (Server Component).
 *
 * Every figure comes from the tenant-scoped partner repository functions, each
 * called with the server-derived context. No platform/admin data source is used
 * and nothing is fabricated: empty collections render honest empty states.
 */

import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import {
  getPartnerEarnings,
  listPartnerFulfilmentGroups,
  listPartnerProducts,
} from "@/lib/partner/repository";
import {
  computePartnerDashboard,
  isActiveFulfilmentStatus,
  type RecentOrder,
} from "@/lib/partner-portal/dashboard";

export const dynamic = "force-dynamic";

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusClasses(status: string) {
  if (isActiveFulfilmentStatus(status)) {
    return "border-sindoor/20 bg-sindoor/10 text-sindoor";
  }
  if (status === "delivered") {
    return "border-terracotta/20 bg-terracotta/10 text-terracotta";
  }
  return "border-sand-border bg-rang-paper text-muted-ink";
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-sand-border bg-surface p-5 shadow-sm">
      <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-ink">
        {label}
      </p>
      <p className={`mt-3 font-serif text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-2 font-sans text-xs text-muted-ink">{hint}</p>
    </div>
  );
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sand-border bg-surface px-6 py-10 text-center">
        <p className="font-serif text-base font-semibold text-deep-ink">
          No orders yet
        </p>
        <p className="mx-auto mt-1 max-w-md font-sans text-sm text-muted-ink">
          Orders containing your products will appear here once a customer
          checks out. Nothing is shown until there is real data.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
      <table className="w-full text-left font-sans text-sm">
        <thead className="bg-rang-paper/60 text-xs uppercase tracking-wider text-muted-ink">
          <tr>
            <th className="px-4 py-3 font-semibold">Order</th>
            <th className="px-4 py-3 font-semibold">Items</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Placed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-border">
          {orders.map((order) => (
            <tr key={order.id || order.customerOrderId}>
              <td className="px-4 py-3 font-medium text-deep-ink">
                #{order.customerOrderId || order.id}
              </td>
              <td className="px-4 py-3 text-muted-ink">{order.itemCount}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusClasses(order.status)}`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-ink">
                {formatDate(order.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PartnerOverviewPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  const [groups, products, earnings] = await Promise.all([
    listPartnerFulfilmentGroups(ctx),
    listPartnerProducts(ctx),
    getPartnerEarnings(ctx),
  ]);

  const { counts, recentOrders } = computePartnerDashboard(
    groups,
    products,
    earnings
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-deep-ink">Overview</h1>
        <p className="mt-1 font-sans text-sm text-muted-ink">
          A live view of your catalogue, fulfilment queue and pending earnings.
        </p>
      </div>

      <section
        aria-label="Key figures"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="Active orders"
          value={String(counts.activeOrders)}
          hint="Awaiting dispatch or delivery"
          accent="text-sindoor"
        />
        <StatCard
          label="Products"
          value={String(counts.products)}
          hint="Items in your catalogue"
          accent="text-terracotta"
        />
        <StatCard
          label="Pending earnings"
          value={inr(counts.pendingEarnings)}
          hint={`${counts.pendingEarningsEntries} unsettled ledger ${
            counts.pendingEarningsEntries === 1 ? "entry" : "entries"
          }`}
          accent="text-deep-ink"
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-deep-ink">
            Recent orders
          </h2>
          <p className="font-sans text-xs text-muted-ink">
            Latest fulfilment groups assigned to you
          </p>
        </div>
        <RecentOrders orders={recentOrders} />
      </section>
    </div>
  );
}
