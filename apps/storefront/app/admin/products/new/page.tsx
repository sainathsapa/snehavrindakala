"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface ProductVariant {
  id?: string;
  title: string;
  sku: string;
  prices: Array<{ currency_code: string; amount: number }>;
  inventory_quantity?: number;
}

interface ProductImage {
  id?: string;
  url: string;
  rank?: number;
}

interface ProductFormData {
  title: string;
  handle: string;
  description: string;
  status: string;
  category_id: string;
  is_new: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  options: Array<{ title: string; values: string[] }>;
}

export default function ProductFormPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState<ProductFormData>({
    title: "",
    handle: "",
    description: "",
    status: "draft",
    category_id: "",
    is_new: false,
    variants: [
      { title: "Default", sku: "", prices: [{ currency_code: "inr", amount: 0 }] },
    ],
    images: [],
    options: [{ title: "Size", values: ["Default"] }],
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          handle: form.handle,
          description: form.description,
          status: form.status,
          category_id: form.category_id,
          is_new: form.is_new,
          variants: form.variants,
          images: form.images,
          options: form.options,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Product saved successfully." });
        setTimeout(() => {
          window.location.href = "/admin/products";
        }, 1500);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to save product." });
      }
    } catch {
      setMessage({ ok: false, text: "Error saving product." });
    } finally {
      setSaving(false);
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const addVariant = () => {
    setForm({
      ...form,
      variants: [
        ...form.variants,
        { title: `Variant ${form.variants.length + 1}`, sku: "", prices: [{ currency_code: "inr", amount: 0 }] },
      ],
    });
  };

  const removeVariant = (index: number) => {
    if (form.variants.length <= 1) return;
    setForm({
      ...form,
      variants: form.variants.filter((_, i) => i !== index),
    });
  };

  const addImage = () => {
    setForm({ ...form, images: [...form.images, { url: "", rank: form.images.length }] });
  };

  const removeImage = (index: number) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) });
  };

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Products
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Add New Product
          </h1>
          <p className="text-muted-ink font-sans">
            Create a new product listing.
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

        <form onSubmit={handleSave} className="space-y-8">
          {/* Basic Info */}
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-6">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Product Title
                </label>
                <input
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g. Hand-painted Terracotta Vase"
                  required
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  URL Handle
                </label>
                <input
                  name="handle"
                  type="text"
                  value={form.handle}
                  onChange={(e) => handleInputChange("handle", e.target.value)}
                  placeholder="e.g. hand-painted-terracotta-vase"
                  required
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
                placeholder="Describe the product, materials, care details..."
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Status
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Category
                </label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={(e) => handleInputChange("category_id", e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
                >
                  <option value="">No category</option>
                </select>
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_new}
                    onChange={() => setForm({ ...form, is_new: !form.is_new })}
                    className="rounded border text-sindoor focus:ring-sindoor"
                  />
                  <span className="text-sm font-sans text-deep-ink">New Arrival</span>
                </label>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif font-semibold text-deep-ink">
                Variants & Pricing
              </h2>
              <button
                type="button"
                onClick={addVariant}
                className="px-3 py-1.5 bg-sindoor text-rang-paper rounded-md text-sm font-medium hover:bg-sindoor/90 transition-colors"
              >
                + Add Variant
              </button>
            </div>
            <div className="space-y-4">
              {form.variants.map((variant, idx) => (
                <div
                  key={variant.id || idx}
                  className="border border-sand-border rounded-lg p-4 bg-rang-paper/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                      Variant {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      disabled={form.variants.length <= 1}
                      className="text-xs text-sindoor hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-sans font-medium text-muted-ink">Title</label>
                      <input
                        value={variant.title}
                        onChange={(e) => {
                          const newVariants = [...form.variants];
                          newVariants[idx].title = e.target.value;
                          setForm({ ...form, variants: newVariants });
                        }}
                        className="w-full px-2 py-1 rounded border border-sand-border bg-surface text-sm font-sans"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-sans font-medium text-muted-ink">SKU</label>
                      <input
                        value={variant.sku}
                        onChange={(e) => {
                          const newVariants = [...form.variants];
                          newVariants[idx].sku = e.target.value;
                          setForm({ ...form, variants: newVariants });
                        }}
                        className="w-full px-2 py-1 rounded border border-sand-border bg-surface text-sm font-sans"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-sans font-medium text-muted-ink">Price (INR)</label>
                      <input
                        type="number"
                        value={variant.prices[0]?.amount || ""}
                        onChange={(e) => {
                          const newVariants = [...form.variants];
                          newVariants[idx].prices[0].amount = parseFloat(e.target.value) || 0;
                          setForm({ ...form, variants: newVariants });
                        }}
                        className="w-full px-2 py-1 rounded border border-sand-border bg-surface text-sm font-sans"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif font-semibold text-deep-ink">
                Images
              </h2>
              <button
                type="button"
                onClick={addImage}
                className="px-3 py-1.5 bg-sindoor text-rang-paper rounded-md text-sm font-medium hover:bg-sindoor/90 transition-colors"
              >
                + Add Image
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {form.images.map((img, idx) => (
                <div key={img.id || idx} className="border border-sand-border rounded-lg p-3 bg-surface">
                  <div className="aspect-square bg-rang-paper flex items-center justify-center relative overflow-hidden">
                    {img.url ? (
                      <img src={img.url} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm text-muted-ink">No image</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 text-sindoor hover:text-sindoor/90"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-sans font-medium text-muted-ink">Image URL</label>
                    <input
                      value={img.url}
                      onChange={(e) => {
                        const newImages = [...form.images];
                        newImages[idx].url = e.target.value;
                        setForm({ ...form, images: newImages });
                      }}
                      className="w-full px-2 py-1 rounded border border-sand-border bg-surface text-sm font-sans"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-8">
            <Button
              type="submit"
              disabled={saving}
              className="w-auto px-8 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create Product"}
            </Button>
            <Link
              href="/admin/products"
              className="ml-4 px-6 py-3 border border-sand-border text-deep-ink rounded-xl font-medium hover:bg-rang-paper transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
