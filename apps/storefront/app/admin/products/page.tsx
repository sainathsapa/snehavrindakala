"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";

interface Product {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  currency_code: string;
  created_at: string;
  category?: { id: string; name: string };
}

const STATUS_OPTIONS = ["draft", "published", "proposed", "rejected"];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const loadProducts = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" })
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
                variant?.prices?.[0]?.currency_code ||
                p.currency_code ||
                "inr",
              created_at: p.created_at || "",
              category: p.category
                ? { id: p.category.id, name: p.category.name }
                : null,
            };
          })
        );
        setTotalCount(data.count ?? products.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT, products.length]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

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
              <Link
                href={`/admin/products/${p.id}/edit`}
                className="text-sindoor font-medium hover:underline"
              >
                {p.title}
              </Link>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.slug}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.category?.name || "—"}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  p.status === "published"
                    ? "bg-green-100 text-green-800"
                    : p.status === "draft"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-terracotta/10 text-terracotta"
                }`}
              >
                {p.status}
              </span>
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
          <Link
            href="/admin/products/new"
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            <Icon name="add" size={16} className="mr-1" />
            New Product
          </Link>
        </div>

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search product title or slug…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-sand-border bg-white text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium text-muted-ink mb-2 uppercase tracking-wider">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="rounded-md border border-sand-border bg-white px-4 py-2 text-sm font-sans text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Reset
              </button>
            </div>
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
                  Category
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {products.length} of {totalCount} products
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                <Icon name="chevron-left" size={16} /> Prev
              </button>
              <span className="px-2 text-sm font-sans text-muted-ink">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                Next <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
