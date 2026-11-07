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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Analytics) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      </div>
    </main>
  );
}
