import { getDashboardStats } from "./actions";
import Link from "next/link";
import { isSingleBrandMode, isPlatformMode } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const platform = isPlatformMode();

  return (
    <main className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm font-medium text-sindoor tracking-wider uppercase font-sans">
              Admin Dashboard
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight">
              Store Overview
            </h1>
            <p className="mt-2 text-muted-ink font-sans">
              Manage your SnehaVrinda Kala store — orders, products, categories,
              and partners.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="px-6 py-3 border border-sindoor text-sindoor rounded-xl font-medium hover:bg-sindoor hover:text-rang-paper focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
          >
            Settings
          </Link>
        </div>

        {/* Mode badge */}
        <div className="mb-8 flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium font-sans ${
              platform
                ? "bg-leaf/10 text-leaf border border-leaf/20"
                : "bg-sindoor/10 text-sindoor border border-sindoor/20"
            }`}
          >
            Mode: {platform ? "Multi-vendor Platform" : "Single Brand"}
          </span>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="Total Orders"
            value={stats.totalOrders}
            icon="📦"
            href="/admin/orders"
          />
          <StatCard
            title="Total Products"
            value={stats.totalProducts}
            icon="🎨"
            href="/admin/products"
          />
          <StatCard
            title={platform ? "Partners" : "Brand"}
            value={stats.totalArtists}
            icon="👩‍🎨"
            href={platform ? "/admin/partners" : "/admin/settings"}
          />
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon="👥"
            href="/admin/customers"
          />
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="border-b border-sand-border bg-rang-paper p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Recent Orders
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-surface">
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                    Total
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {stats.recentOrders.length > 0 ? (
                  stats.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-rang-paper/50 transition-colors">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {order.id.slice(-8)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-sans text-sm text-deep-ink">
                          {order.customer?.first_name} {order.customer?.last_name}
                        </div>
                        <div className="text-xs text-muted-ink">
                          {order.customer?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                            order.status === "completed"
                              ? "bg-leaf/10 text-leaf border border-leaf/20"
                              : order.status === "cancelled"
                                ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                                : order.status === "pending"
                                  ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                                  : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-sans text-sm ${
                            order.payment_status === "paid"
                              ? "text-leaf"
                              : order.payment_status === "refunded"
                                ? "text-sindoor"
                                : "text-muted-ink"
                          } font-medium`}
                        >
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                        {(order.total / 100).toFixed(2)} {order.currency_code?.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-muted-ink font-sans">
                        No orders yet. Your first sale is waiting!
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {stats.recentOrders.length > 0 && (
            <div className="border-t border-sand-border bg-surface p-4">
              <Link
                href="/admin/orders"
                className="block text-center text-sm font-medium text-sindoor hover:underline"
              >
                View all orders →
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard
            title="Manage Orders"
            description="View, update, and track all customer orders."
            href="/admin/orders"
            icon="📦"
          />
          <QuickActionCard
            title="Manage Products"
            description="Add, edit, and organize your catalogue."
            href="/admin/products"
            icon="🎨"
          />
          <QuickActionCard
            title="Manage Categories"
            description="Create and organize product categories."
            href="/admin/categories"
            icon="📁"
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-sand-border bg-surface p-6 hover:shadow-md transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-3xl font-serif font-bold text-deep-ink">
            {value}
          </p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </a>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-sand-border bg-surface p-8 hover:shadow-md transition-colors"
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-serif font-semibold text-deep-ink mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-ink font-sans">{description}</p>
    </a>
  );
}
