"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";

interface Category {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = ["active", "draft"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const loadCategories = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/categories?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCategories(
          (data.categories || []).map((c: any) => ({
            id: c.id || "",
            name: c.name || "",
            slug: c.slug || "",
            status: c.status ?? (c.is_active === false ? "draft" : "active"),
            created_at: c.created_at || "",
          }))
        );
        setTotalCount(data.count ?? categories.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT, categories.length]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  async function deleteCategory(id: string) {
    if (!window.confirm("Delete this category?")) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete category");
      loadCategories();
    } catch (err: any) {
      alert(err.message || "Failed to delete category");
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading categories...</p>
        </div>
      </main>
    );
  }

  const categoryRows =
    categories.length > 0
      ? categories.map((c: Category) => (
          <tr key={c.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{c.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              <Link
                href={`/admin/categories/${c.id}/edit`}
                className="text-sindoor font-medium hover:underline"
              >
                {c.name}
              </Link>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {c.slug}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  c.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {c.status}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(c.created_at).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/categories/${c.id}/edit`}
                  className="text-sindoor font-medium hover:underline text-sm"
                >
                  <Icon name="edit" size={16} className="mr-1" />
                  Edit
                </Link>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="text-red-600 font-medium hover:underline text-sm"
                >
                  <Icon name="delete" size={16} className="mr-1" />
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No categories found.
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
              Categories
            </h1>
            <p className="text-muted-ink font-sans">
              Manage product categories.
            </p>
          </div>
          <Link
            href="/admin/categories/new"
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            <Icon name="add" size={16} className="mr-1" />
            New Category
          </Link>
        </div>

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search category name or slug…"
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
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {categoryRows}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {categories.length} of {totalCount} categories
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
