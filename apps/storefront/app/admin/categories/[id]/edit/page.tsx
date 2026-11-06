"use client";

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    loadCategory(id);
  }, [id]);

  async function loadCategory(categoryId: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/admin/categories/${categoryId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const cat = data.product_category || data.category;
        setForm({
          name: cat.name || "",
          description: cat.description || "",
        });
      } else {
        setMessage({ ok: false, text: "Category not found." });
      }
    } catch (err) {
      setMessage({ ok: false, text: "Failed to load category." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/admin/categories/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
          }),
        }
      );
      if (res.ok) {
        setMessage({ ok: true, text: "Category updated successfully." });
        setTimeout(() => {
          window.location.href = "/admin/categories";
        }, 1000);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to update category." });
      }
    } catch {
      setMessage({ ok: false, text: "Error updating category." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading category...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/categories"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Categories
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Edit Category
          </h1>
        </div>

        {message && (
          <p className={`mb-6 rounded-md p-3 text-sm font-sans ${
            message.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
              Category Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Category Name
                </label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="w-auto px-8 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update Category"}
            </Button>
            <Link
              href="/admin/categories"
              className="px-6 py-3 border border-sand-border text-deep-ink rounded-xl font-medium hover:bg-rang-paper transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
