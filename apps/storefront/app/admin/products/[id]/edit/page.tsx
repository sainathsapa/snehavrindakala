"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ProductImages, type ProductImage } from "@/components/product-images";
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
  // One price per size. Empty for a single-variant work, which keeps the old
  // single price field exactly as it was.
  const [variantRows, setVariantRows] = useState<
    Array<{ id: string; title: string; amount: string }>
  >([]);
  const [currency, setCurrency] = useState("inr");
  const [images, setImages] = useState<ProductImage[]>([]);
  // Maker and stock terms live in product metadata; they are editable here so
  // an existing work can be re-attributed without touching the database.
  const [artist, setArtist] = useState("");
  const [stockType, setStockType] = useState("ready_to_ship");
  const [description, setDescription] = useState("");
  // The six facts a buyer needs and the storefront already renders. They are
  // stored as tags, so until now they could only be set by writing SQL — which
  // is why every product had no size, no framing and no care note.
  // Whether the studio has put a tape on the work. Gates the certificate.
  const [measured, setMeasured] = useState(false);
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

        // Two sizes are two prices, and the single `total` is only one of them.
        const loadedVariants = ((data.variants ?? []) as any[])
          .filter((variant) => variant?.id)
          .map((variant) => ({
            id: String(variant.id),
            title: String(variant.title || "Default"),
            amount: String(
              Math.round(
                Number(
                  variant.calculated_price?.calculated_amount ??
                    variant.prices?.[0]?.amount ??
                    0
                ) / 100
              )
            ),
          }));
        setVariantRows(loadedVariants.length > 1 ? loadedVariants : []);
        setCurrency(loaded.currency_code || "inr");
        setCategoryId(loaded.category_id || "");
        const galleryUrls = ((data.images ?? []) as any[])
          .map((item) => item?.url)
          .filter(Boolean) as string[];
        const ordered =
          data.thumbnail && !galleryUrls.includes(data.thumbnail)
            ? [data.thumbnail as string, ...galleryUrls]
            : galleryUrls;
        setImages(ordered.map((url) => ({ url })));
        // Artist and availability live in tags, because the Medusa store API
        // does not expose metadata. Reading metadata here left both fields blank
        // on every product created through the panel.
        const tagValue = (prefix: string): string => {
          const tags = [
            ...(data.tags ?? []),
            ...(data.metadata?.tags ?? []),
          ] as { value?: string }[];
          const hit = tags.find((t) =>
            typeof t?.value === "string" && t.value.startsWith(`${prefix}:`)
          );
          return hit?.value ? hit.value.slice(prefix.length + 1) : "";
        };
        setArtist(
          tagValue("artist") || (data.metadata?.artist as string) || ""
        );
        setStockType(
          tagValue("stock") ||
            (data.metadata?.stock_type as string) ||
            "ready_to_ship"
        );
        setDescription(data.description || "");
        setSpecs({
          dimensions: data.specs?.dimensions || "",
          medium: data.specs?.medium || "",
          framing: data.specs?.framing || "",
          year: data.specs?.year || "",
          edition: data.specs?.edition || "",
          care: data.specs?.care || "",
          provenance: data.specs?.provenance || "",
          condition: data.specs?.condition || "",
        });
        setMeasured(Boolean(data.measured));
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
          // Sent only for a multi-size work: the API writes each row to its own
          // variant, so saving a description cannot reset a price.
          ...(variantRows.length
            ? {
                variants: variantRows.map((row) => ({
                  id: row.id,
                  amount: row.amount ? parseInt(row.amount, 10) * 100 : 0,
                })),
              }
            : {}),
          currency_code: currency,
          ...(categoryId ? { category_id: categoryId } : {}),
          images: images.map((item) => item.url),
          artist,
          stock_type: stockType,
          description,
          specs,
          measured,
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

              {/* Specifications. Each one renders as its own row on the product
                  page and only when it has a value, so an empty box here means a
                  silent absence rather than a blank line on the page. Left empty
                  on purpose where the fact is not known — an invented size is a
                  returned order. */}
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
                {variantRows.length > 1 ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                      Prices, one per size
                    </label>
                    <p className="mb-3 font-sans text-xs text-muted-ink">
                      Each size has its own price. Changing one here does not touch
                      the others.
                    </p>
                    <div className="space-y-3">
                      {variantRows.map((row, index) => (
                        <div key={row.id} className="flex flex-wrap items-end gap-3">
                          <span className="flex-1 min-w-[10rem] pb-2 font-sans text-sm text-deep-ink">
                            {row.title}
                          </span>
                          <div className="w-36">
                            <input
                              type="number"
                              min="0"
                              value={row.amount}
                              onChange={(event) => {
                                const next = [...variantRows];
                                next[index] = { ...next[index], amount: event.target.value };
                                setVariantRows(next);
                              }}
                              className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                            />
                          </div>
                          <span className="pb-2 font-sans text-xs text-muted-ink">
                            {currency.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
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
                )}
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
