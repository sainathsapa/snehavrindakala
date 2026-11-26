"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ProductImages, type ProductImage } from "@/components/product-images";
import { SlugField, useAutoSlug } from "@/components/admin/slug-field";

interface Category {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const [title, setTitle] = useState("");
  const slugState = useAutoSlug();
  const [status, setStatus] = useState("draft");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("inr");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  // The maker and stock terms are product metadata on the Medusa record. They
  // were never editable here, so every product created through the admin fell
  // back to the house name and "ready to ship".
  const [artist, setArtist] = useState("Sneha Sainath Sapa");
  const [stockType, setStockType] = useState("ready_to_ship");
  const [description, setDescription] = useState("");
  /** What stopped the save. Shown beside the form, never only in the console. */
  const [formError, setFormError] = useState<string | null>(null);
  // Whether the studio measured the work. Gates the certificate, not the page.
  const [measured, setMeasured] = useState(false);
  // The artwork's specifications. Stored as tags and rendered as the Details
  // block; left blank when unknown rather than guessed.
  const [specs, setSpecs] = useState({
    dimensions: "",
    medium: "",
    framing: "",
    year: "",
    edition: "",
    care: "",
    provenance: "",
    condition: "",
  });
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
    setFormError(null);

    // A work may be drafted while its size is still to be measured — that is what
    // a draft is for. It may not go live without one: the product page would ask
    // a buyer to spend real money on a work whose size is blank, and every
    // question about it becomes an email.
    if (status === "published" && !String(specs.dimensions || "").trim()) {
      setFormError(
        "Add the dimensions before publishing. The work can stay a draft without them; it cannot go on sale without its size."
      );
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slugState.value,
          status,
          total: price ? parseInt(price) * 100 : 0,
          currency_code: currency,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(images.length ? { images: images.map((item) => item.url) } : {}),
          artist,
          stock_type: stockType,
          description,
          specs,
          measured,
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
                  Photographs
                </label>
                <div className="max-w-[260px]">
                  <ProductImages images={images} onChange={setImages} />
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
                  <p className="mt-1 font-sans text-[11px] text-muted-ink">
                    Shown on the card, the product page and its wall label.
                  </p>
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

              {/* Specifications. Each renders as its own row on the product page
                  and only when it has a value, so an empty box means a silent
                  absence rather than a blank line on the page. */}
              <fieldset className="rounded-md border border-sand-border p-5">
                <legend className="px-2 font-sans text-sm font-medium text-deep-ink">
                  Specifications
                </legend>
                <p className="mb-4 font-sans text-xs text-muted-ink">
                  Shown as the Details block on the product page. Leave a field
                  empty if it is not known — it is simply omitted, never
                  guessed.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    ["dimensions", "Dimensions", "30 × 40 cm"],
                    ["medium", "Medium & materials", "Natural pigment on handmade paper"],
                    ["framing", "Framing", "Unframed, ships rolled"],
                    ["year", "Year", "2025"],
                    ["edition", "Edition", "1 of 1"],
                    ["care", "Care", "Keep out of direct sunlight"],
                    [
                      "provenance",
                      "Provenance",
                      "From the artist's studio, 2025",
                    ],
                    [
                      "condition",
                      "Condition",
                      "Excellent; a faint mark on the reverse",
                    ],
                  ] as const).map(([key, label, hint]) => (
                    <div key={key}>
                      <label className="block font-sans text-sm font-medium text-deep-ink mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={specs[key]}
                        placeholder={hint}
                        onChange={(e) =>
                          setSpecs((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                      />
                    </div>
                  ))}
                </div>
                {/* A certificate may only print a size somebody measured. The
                    checkbox is the whole distinction: ticked, the number is
                    certified; unticked, the page still shows it as "stated by
                    the studio" and the certificate leaves the row out. */}
                <label className="mt-4 flex items-start gap-3 font-sans text-sm text-deep-ink">
                  <input
                    type="checkbox"
                    checked={measured}
                    onChange={(e) => setMeasured(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have measured this work
                    <span className="block font-sans text-xs text-muted-ink">
                      Ticked, the dimensions are printed on the certificate of
                      authenticity. Left unticked, they are shown on the product
                      page as stated but are not certified.
                    </span>
                  </span>
                </label>
              </fieldset>

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
                <SlugField slug={slugState} title={title} prefix="/products/" />
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
                  {/* A missing category used to mean abandoning the form to go
                      make one. This opens the category screen in a new tab, so
                      the work being entered is still there on the way back. */}
                  <a
                    href="/admin/categories/new"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-sans text-[11px] text-sindoor underline-offset-2 hover:underline"
                  >
                    + Add a new category
                  </a>
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
                {formError ? (
                  <p role="alert" className="mt-3 font-sans text-sm text-sindoor">
                    {formError}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
