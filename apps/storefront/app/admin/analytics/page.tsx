"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardStats {
  totalOrders: number;
  totalProducts: number;
  totalArtists: number;
  totalCustomers: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalProducts: 0,
    totalArtists: 0,
    totalCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setStats({
          totalOrders: data.total_orders || 0,
          totalProducts: data.total_products || 0,
          totalArtists: data.total_artists || 0,
          totalCustomers: data.total_customers || 0,
        });
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

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-muted-ink font-sans">
              Business insights and performance metrics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Orders
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {stats.totalOrders}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Products
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {stats.totalProducts}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Artists
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {stats.totalArtists}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-sand-border bg-surface">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
              Total Customers
            </p>
            <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
              {stats.totalCustomers}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}