"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ImageUpload } from "@/components/image-upload";

interface Category {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("inr");
  const [categoryId, setCategoryId] = useState("");
  const [image, setImage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/categories?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCategories(
          (data.categories || []).map((c: any) => ({
            id: c.id || "",
            name: c.name || "",
          }))
        );
        setLoadingCats(false);
      })
      .catch(() => setLoadingCats(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          status,
          total: price ? parseInt(price) * 100 : 0,
          currency_code: currency,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(image ? { image } : {}),
        }),
      });
      if (res.ok) {
        window.location.href = "/admin/products";
      }
    } catch (err) {
      console.error("Failed to create product", err);
      setSaving(false);
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/products" className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4">
              ← Back to Products
            </Link>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              New Product
            </h1>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product image. A work without a photograph cannot be sold, and
                  Medusa renders nothing on the card or the detail page until
                  `thumbnail` is set. */}
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                  Product image
                </label>
                <div className="max-w-[260px]">
                  <ImageUpload value={image} onChange={setImage} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Slug
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  >
                    <option value="">No category</option>
                    {loadingCats ? (
                      <option disabled>Loading categories…</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="proposed">Proposed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Price
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                  >
                    <option value="inr">INR</option>
                    <option value="usd">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
