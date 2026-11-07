"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

export default function CategoryCreatePage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          is_active: true,
          is_internal: false,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Category created successfully." });
        setTimeout(() => {
          window.location.href = "/admin/categories";
        }, 1000);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create category." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating category." });
    } finally {
      setSaving(false);
    }
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
            Add Category
          </h1>
          <p className="text-muted-ink font-sans">
            Create a new product category.
          </p>
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
                  placeholder="e.g. Painting & Drawing"
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
                  placeholder="Describe this category..."
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
              {saving ? "Creating…" : "Create Category"}
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
