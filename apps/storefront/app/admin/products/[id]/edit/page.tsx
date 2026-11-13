"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ImageUpload } from "@/components/image-upload";
import { useParams } from "next/navigation";

interface Product {
  id: string;
  title: string;
  slug: string;
  status: string;
  total: number;
  currency_code: string;
  created_at: string;
  category_id?: string;
  // Medusa keeps the card image in `thumbnail` and the gallery in `images`.
  thumbnail?: string | null;
  images?: { url?: string }[];
  metadata?: Record<string, unknown> | null;
  description?: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function EditProductPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [productStatus, setProductStatus] = useState("draft");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("inr");
  const [image, setImage] = useState("");
  // Maker and stock terms live in product metadata; they are editable here so
  // an existing work can be re-attributed without touching the database.
  const [artist, setArtist] = useState("");
  const [stockType, setStockType] = useState("ready_to_ship");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/admin/products/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const loaded: Product = {
          id: data.id || "",
          title: data.title || "",
          slug: data.slug || "",
          status: data.status || "",
          total: data.total || 0,
          currency_code: data.currency_code || "inr",
          created_at: data.created_at || "",
          category_id: data.category_id?.[0]?.id || data.category_id || "",
          metadata: data.metadata ?? null,
          description: data.description ?? "",
        };
        setProduct(loaded);
        setTitle(loaded.title);
        setSlug(loaded.slug);
        setProductStatus(loaded.status || "draft");
        setPrice((loaded.total / 100).toString());
        setCurrency(loaded.currency_code || "inr");
        setCategoryId(loaded.category_id || "");
        setImage(data.thumbnail || data.images?.[0]?.url || "");
        setArtist((data.metadata?.artist as string) || "");
        setStockType((data.metadata?.stock_type as string) || "ready_to_ship");
        setDescription(data.description || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

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
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          status: productStatus,
          total: price ? parseInt(price) * 100 : 0,
          currency_code: currency,
          ...(categoryId ? { category_id: categoryId } : {}),
          image,
          artist,
          stock_type: stockType,
          description,
        }),
      });
      if (res.ok) {
        window.location.href = "/admin/products";
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading product...</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Product not found.</p>
        </div>
      </main>
    );
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
              Edit Product
            </h1>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Replace or clear the product photograph. */}
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
                    Artist
                  </label>
                  <input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                    Availability
                  </label>
                  <select
                    value={stockType}
                    onChange={(e) => setStockType(e.target.value)}
                    className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                  >
                    <option value="ready_to_ship">Ready to ship</option>
                    <option value="made_to_order">Made to order</option>
                    <option value="custom_only">Commission only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
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
                    value={productStatus}
                    onChange={(e) => setProductStatus(e.target.value)}
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
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
