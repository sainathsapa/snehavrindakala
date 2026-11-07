"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function CategoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    fetch(`/api/admin/categories/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data: any) => {
        const cat = data.product_category || data.category || data;
        setForm({
          name: cat.name || "",
          description: cat.description || "",
          is_active: cat.is_active ?? true,
        });
        setLoading(false);
      })
      .catch(() => {
        setMessage({ ok: false, text: "Category not found." });
        setLoading(false);
      });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Category updated successfully." });
        setTimeout(() => router.push("/admin/categories"), 800);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          ok: false,
          text: data.error || "Failed to update category.",
        });
      }
    } catch {
      setMessage({ ok: false, text: "Failed to update category." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this category?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/categories");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          ok: false,
          text: data.error || "Failed to delete category.",
        });
        setSaving(false);
      }
    } catch {
      setMessage({ ok: false, text: "Failed to delete category." });
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
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm font-sans ${
              message.ok
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-sand-border bg-surface p-6 space-y-4">
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Category Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-2 w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                className="mt-2 w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-sans text-deep-ink">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
                className="h-4 w-4"
              />
              Active (visible on the storefront)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sindoor px-5 py-2.5 text-sm font-sans font-medium text-white hover:bg-sindoor/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded-md border border-red-300 px-5 py-2.5 text-sm font-sans font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete Category
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
