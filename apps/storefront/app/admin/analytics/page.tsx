"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Analytics {
  summary: {
    total_revenue: string;
    total_orders: string;
    unique_customers: string;
  };
  monthly_trend: { month: string; revenue: string; orders: string }[];
  top_products: {
    title: string;
    handle: string;
    units_sold: string;
    revenue: string;
  }[];
  status_distribution: { status: string; count: string }[];
}

interface WishlistInsight {
  handle: string;
  title: string;
  price: number | null;
  saves: number;
  last_saved: string | null;
}

function money(value: string | number) {
  const amount = Number(value || 0) / 100;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [wishlist, setWishlist] = useState<{
    waiting: WishlistInsight[];
    purchased: WishlistInsight[];
    total_saves: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Analytics) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // The saved list has been collected since it was written and read nowhere.
    // It is cheap to load beside the dashboard's own numbers.
    fetch("/api/admin/analytics/wishlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((w: any) => setWishlist(w))
      .catch(() => setWishlist(null));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading analytics...</p>
        </div>
      </main>
    );
  }

  const summary = data?.summary;
  const monthly = data?.monthly_trend ?? [];
  const topProducts = data?.top_products ?? [];
  const statuses = data?.status_distribution ?? [];

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Analytics Dashboard
          </h1>
          <p className="text-muted-ink font-sans">
            Business insights and performance metrics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {money(summary?.total_revenue ?? 0)}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Orders
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {summary?.total_orders ?? 0}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Unique Customers
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {summary?.unique_customers ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-sand-border bg-surface overflow-hidden">
            <h2 className="px-6 py-4 font-serif font-semibold text-deep-ink border-b border-sand-border">
              Monthly Trend
            </h2>
            {monthly.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-ink font-sans">
                No sales recorded yet.
              </p>
            ) : (
              <table className="w-full text-sm font-sans">
                <thead className="bg-rang-paper text-muted-ink">
                  <tr>
                    <th className="text-left px-6 py-3">Month</th>
                    <th className="text-right px-6 py-3">Orders</th>
                    <th className="text-right px-6 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.month} className="border-t border-sand-border">
                      <td className="px-6 py-3">{monthLabel(row.month)}</td>
                      <td className="px-6 py-3 text-right">{row.orders}</td>
                      <td className="px-6 py-3 text-right">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-sand-border bg-surface overflow-hidden">
            <h2 className="px-6 py-4 font-serif font-semibold text-deep-ink border-b border-sand-border">
              Top Products
            </h2>
            {topProducts.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-ink font-sans">
                No product sales yet.
              </p>
            ) : (
              <table className="w-full text-sm font-sans">
                <thead className="bg-rang-paper text-muted-ink">
                  <tr>
                    <th className="text-left px-6 py-3">Product</th>
                    <th className="text-right px-6 py-3">Units</th>
                    <th className="text-right px-6 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((row) => (
                    <tr key={row.handle} className="border-t border-sand-border">
                      <td className="px-6 py-3">
                        <Link
                          href={`/products/${row.handle}`}
                          className="text-sindoor hover:underline"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-right">{row.units_sold}</td>
                      <td className="px-6 py-3 text-right">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-sand-border bg-surface overflow-hidden">
          <h2 className="px-6 py-4 font-serif font-semibold text-deep-ink border-b border-sand-border">
            Orders by Status
          </h2>
          {statuses.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-ink font-sans">
              No orders yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3 px-6 py-4">
              {statuses.map((row) => (
                <span
                  key={row.status}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-border px-3 py-1 text-sm font-sans"
                >
                  <span className="capitalize">{row.status}</span>
                  <span className="font-semibold text-deep-ink">{row.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {wishlist && wishlist.waiting.length > 0 && (
          <section className="mt-6 rounded-xl border border-sand-border bg-surface overflow-hidden">
            <h2 className="px-6 py-4 font-serif font-semibold text-deep-ink border-b border-sand-border">
              Saved, not bought
            </h2>
            <p className="px-6 pt-4 text-sm text-muted-ink font-sans">
              Works visitors put in their list and have not purchased. On a shop
              where each piece is made once, this is the shortest list of things
              worth looking at again — a price, a photograph, a word of
              description.
            </p>
            <table className="mt-4 w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-sand-border text-left text-[11px] uppercase tracking-wider text-muted-ink">
                  <th className="px-6 py-2">Work</th>
                  <th className="px-6 py-2 text-right">Saves</th>
                  <th className="px-6 py-2 text-right">Price</th>
                  <th className="px-6 py-2 text-right">Last saved</th>
                </tr>
              </thead>
              <tbody>
                {wishlist.waiting.map((row) => (
                  <tr key={row.handle} className="border-b border-sand-border/60 last:border-0">
                    <td className="px-6 py-3">
                      <Link
                        href={`/products/${row.handle}`}
                        className="text-deep-ink hover:text-terracotta hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">{row.saves}</td>
                    <td className="px-6 py-3 text-right text-muted-ink">
                      {row.price === null ? "—" : money(row.price)}
                    </td>
                    <td className="px-6 py-3 text-right text-muted-ink">
                      {row.last_saved
                        ? new Date(row.last_saved).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wishlist.purchased.length > 0 && (
              <p className="px-6 py-3 text-xs text-muted-ink font-sans border-t border-sand-border">
                {wishlist.purchased.length} saved work
                {wishlist.purchased.length === 1 ? "" : "s"} have since sold and
                are not listed here.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
