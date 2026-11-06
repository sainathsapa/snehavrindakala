"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StatCard {
  title: string;
  value: string | number;
  subtitle: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  color: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<{
    total_revenue: number;
    total_orders: number;
    unique_customers: number;
    monthly_trend: any[];
    top_products: any[];
    status_distribution: any[];
    recent_orders: any[];
  } | null>(null);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics/dashboard?period=${period}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading analytics...</p>
        </div>
      </main>
    );
  }

  const s: any = stats;
  const revenue = s?.summary?.total_revenue || 0;
  const orders = s?.summary?.total_orders || 0;
  const customers = s?.summary?.unique_customers || 0;
  const aov = orders > 0 ? revenue / orders : 0;

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-muted-ink font-sans">
              Business insights and performance metrics.
            </p>
          </div>
          <select
            defaultValue={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
          >
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
            <option value="365">1 Year</option>
          </select>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={`₹${(revenue / 100).toLocaleString()}`}
            subtitle="Gross sales"
            trend="+12%"
            trendUp={true}
            icon="💰"
            color="text-leaf"
          />
          <StatCard
            title="Total Orders"
            value={orders.toLocaleString()}
            subtitle="Completed orders"
            trend="+8%"
            trendUp={true}
            icon="📦"
            color="text-sindoor"
          />
          <StatCard
            title="Customers"
            value={customers.toLocaleString()}
            subtitle="Unique buyers"
            trend="+5%"
            trendUp={true}
            icon="👥"
            color="text-terracotta"
          />
          <StatCard
            title="Avg Order Value"
            value={`₹${aov.toLocaleString()}`}
            subtitle="Revenue per order"
            trend="+2%"
            trendUp={true}
            icon="📊"
            color="text-indigo"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartCard
            title="Revenue Trend"
            data={s?.monthly_trend || []}
            xKey="month"
            yKey="revenue"
            type="line"
            formatCurrency={true}
          />
          <ChartCard
            title="Order Status"
            data={s?.status_distribution || []}
            xKey="status"
            yKey="count"
            type="bar"
            formatCurrency={false}
          />
        </div>

        {/* Top products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartCard
            title="Top Products"
            data={s?.top_products || []}
            xKey="title"
            yKey="units_sold"
            type="bar"
            formatCurrency={false}
            showTitle={true}
          />
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h3 className="text-lg font-serif font-semibold text-deep-ink mb-4">
              Recent Orders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {(s?.recent_orders || []).map((order: any) => (
                    <tr key={order.id} className="text-sm">
                      <td className="px-4 py-3 font-sans text-deep-ink">
                        #{order.id.slice(-6)}
                      </td>
                      <td className="px-4 py-3 font-sans text-muted-ink">
                        {order.customer_email}
                      </td>
                      <td className="px-4 py-3 font-sans text-deep-ink text-right">
                        {(order.total / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === "completed"
                              ? "bg-leaf/10 text-leaf border border-leaf/20"
                              : order.status === "cancelled"
                                ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                                : "bg-terracotta/10 text-terracotta border border-terracotta/20"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-muted-ink">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendUp,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-sand-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-2xl font-serif font-bold text-deep-ink">{value}</p>
          <p className="text-xs text-muted-ink font-sans">{subtitle}</p>
        </div>
        <div className="text-xl">{icon}</div>
      </div>
      <div className="mt-4 flex items-center gap-1">
        <span
          className={`text-xs font-sans font-medium ${
            trendUp ? "text-leaf" : "text-sindoor"
          }`}
        >
          {trendUp ? "↑" : "↓"} {trend}
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  xKey,
  yKey,
  type,
  formatCurrency,
  showTitle,
}: {
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  type: "line" | "bar";
  formatCurrency: boolean;
  showTitle?: boolean;
}) {
  const maxY =
    data.length > 0
      ? Math.max(...data.map((d) => Number(d[yKey]) || 0))
      : 100;
  const width = 340;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  return (
    <div className="rounded-xl border border-sand-border bg-surface p-6">
      {showTitle && (
        <h3 className="text-lg font-serif font-semibold text-deep-ink mb-4">
          {title}
        </h3>
      )}
      <div className="flex items-center">
        <svg
          width={width}
          height={height}
          className="block"
        >
          {/* Y axis labels */}
          {[0, maxY / 2, maxY].map((val, i) => (
            <text
              key={i}
              x={padding.left - 10}
              y={padding.top + (chartHeight / 2) * i}
              textAnchor="end"
              fontSize="10"
              fill="text-muted-ink"
              className="font-sans"
            >
              {formatCurrency
                ? `₹${(val / 100).toFixed(0)}`
                : Math.round(val)}
            </text>
          ))}
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {type === "line" && data.length > 1 && (
              <polyline
                points={data
                  .map(
                    (d, i) =>
                      `${(i / (data.length - 1)) * chartWidth},${
                        chartHeight -
                        ((Number(d[yKey]) || 0) / maxY) * chartHeight
                      }`
                  )
                  .join(" ")}
                fill="none"
                stroke="text-sindoor"
                strokeWidth="2"
              />
            )}
            {type === "bar" && (
              data.map((d, i) => {
                const barHeight =
                  ((Number(d[yKey]) || 0) / maxY) * chartHeight;
                return (
                  <rect
                    key={i}
                    x={(i / data.length) * chartWidth + 5}
                    y={chartHeight - barHeight}
                    width={chartWidth / data.length - 10}
                    height={barHeight}
                    fill="text-sindoor"
                    rx="2"
                  />
                );
              })
            )}
          </g>
          {/* X axis labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={(i / Math.max(data.length - 1, 1)) * chartWidth + padding.left}
              y={padding.top + chartHeight + 25}
              textAnchor="middle"
              fontSize="10"
              fill="text-muted-ink"
              className="font-sans"
            >
              {formatCurrency
                ? new Date(d[xKey]).toLocaleDateString(undefined, {
                    month: "short",
                  })
                : String(d[xKey]).slice(0, 10)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
