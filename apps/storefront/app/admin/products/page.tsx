"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Product {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  currency_code: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/products?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setProducts(
          (data.products || []).map((p: any) => {
            const variant = (p.variants || [])[0];
            const price = variant?.prices?.[0]?.amount ?? p.total ?? 0;
            return {
              id: p.id || "",
              title: p.title || "",
              slug: p.handle || p.slug || "",
              status: p.status || "",
              price,
              currency_code:
                variant?.prices?.[0]?.currency_code || p.currency_code || "inr",
              created_at: p.created_at || "",
            };
          })
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading products...</p>
        </div>
      </main>
    );
  }

  const productRows =
    products.length > 0
      ? products.map((p: Product) => (
          <tr key={p.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{p.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {p.title}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.slug}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {p.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {(p.price / 100).toFixed(2)}
              {p.currency_code?.toUpperCase()}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(p.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No products found.
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Products
            </h1>
            <p className="text-muted-ink font-sans">
              Manage product catalog.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Price
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {productRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}