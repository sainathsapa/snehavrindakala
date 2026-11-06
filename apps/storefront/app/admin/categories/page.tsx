"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCategories(
          (data.categories || []).map((c: any) => ({
            id: c.id || "",
            name: c.name || "",
            slug: c.slug || "",
            status: c.status || "",
            created_at: c.created_at || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {c.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(c.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={5} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No categories found.</p>
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
            New Category
          </Link>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {categoryRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}