"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total_orders: number;
  total_products: number;
  total_customers: number;
  total_artists: number;
}

const CARDS: { key: keyof Stats; label: string; href: string }[] = [
  { key: "total_orders", label: "Total Orders", href: "/admin/orders" },
  { key: "total_products", label: "Total Products", href: "/admin/products" },
  { key: "total_customers", label: "Total Customers", href: "/admin/customers" },
  { key: "total_artists", label: "Total Artists", href: "/admin/partners" },
];

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: Stats) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-muted-ink font-sans">
          Welcome to the SnehaVrinda Kala admin panel.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="p-6 rounded-xl border border-sand-border bg-surface hover:border-sindoor transition-colors"
            >
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                {card.label}
              </p>
              <p className="text-2xl font-serif font-semibold text-deep-ink mt-2">
                {loading ? "…" : stats?.[card.key] ?? 0}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/products/new"
            className="p-6 rounded-xl border border-sand-border bg-surface hover:border-sindoor transition-colors"
          >
            <p className="font-serif font-semibold text-deep-ink">Add a product</p>
            <p className="text-sm text-muted-ink font-sans mt-1">
              Publish a new artwork to the storefront.
            </p>
          </Link>
          <Link
            href="/admin/partners/new"
            className="p-6 rounded-xl border border-sand-border bg-surface hover:border-sindoor transition-colors"
          >
            <p className="font-serif font-semibold text-deep-ink">Onboard a partner</p>
            <p className="text-sm text-muted-ink font-sans mt-1">
              Register an artist or partner collective.
            </p>
          </Link>
          <Link
            href="/admin/analytics"
            className="p-6 rounded-xl border border-sand-border bg-surface hover:border-sindoor transition-colors"
          >
            <p className="font-serif font-semibold text-deep-ink">View analytics</p>
            <p className="text-sm text-muted-ink font-sans mt-1">
              Revenue, orders and top products.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
