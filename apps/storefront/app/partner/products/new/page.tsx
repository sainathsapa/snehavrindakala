import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext, requirePartnerPermission } from "@/lib/partner/context";
import { createSubmission } from "@/lib/partner-portal/products";

export const dynamic = "force-dynamic";

async function createAction(formData: FormData) {
  "use server";
  const ctx = await requirePartnerPermission("products:write");
  if (!ctx) redirect("/partner/login");

  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  // The library validates the parsed shape; this only makes the form's JSON
  // fields type-friendly at the call site.
  const jsonField = <T,>(name: string): T | undefined => {
    const raw = text(name);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`${name} must be valid JSON.`);
    }
  };
  const imageUrls = text("images")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let newId: string | null = null;
  let message: string | null = null;
  try {
    const product = await createSubmission(ctx, {
      title: text("title"),
      description: text("description"),
      ...(text("productId") ? { productId: text("productId") } : {}),
      attributes: jsonField<Record<string, unknown>>("attributes"),
      variants: jsonField<Array<Record<string, unknown>>>("variants"),
      pricing: jsonField<Record<string, unknown>>("pricing"),
      images: imageUrls,
    });
    newId = product.id;
  } catch (err: any) {
    message = err?.message ?? "Could not save this submission.";
  }

  if (message) redirect(`/partner/products/new?error=${encodeURIComponent(message)}`);
  redirect(`/partner/products/${encodeURIComponent(newId!)}?notice=${encodeURIComponent("Draft saved. Review it, then submit for approval.")}`);
}

const textareaClass =
  "w-full rounded-md border border-sand-border bg-white px-3 py-2 font-mono text-sm text-deep-ink placeholder:text-muted-ink/60 focus:outline-none focus:ring-2 focus:ring-sindoor";
const inputClass =
  "w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink placeholder:text-muted-ink/60 focus:outline-none focus:ring-2 focus:ring-sindoor";
const labelClass =
  "mb-2 block font-sans text-sm font-medium text-deep-ink";
const hintClass = "mt-1 font-sans text-xs text-muted-ink";

export default async function NewPartnerProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");
  const { error } = await searchParams;

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/partner/products" className="font-sans text-sm text-sindoor hover:underline">
            ← Back to submissions
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            New product submission
          </h1>
          <p className="font-sans text-muted-ink">
            Save a draft now; submit it for platform review when the details are complete.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-3 font-sans text-sm text-terracotta"
          >
            {error}
          </div>
        )}

        <form action={createAction} className="space-y-6">
          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-4 font-serif text-xl font-semibold text-deep-ink">Basic details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className={labelClass}>
                  Title <span className="text-terracotta">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g. Hand-block printed silk stole"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="description" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  maxLength={5000}
                  placeholder="Describe the work, its making and its provenance."
                  className={`${textareaClass} font-sans`}
                />
              </div>
              <div>
                <label htmlFor="productId" className={labelClass}>
                  Product reference (optional)
                </label>
                <input
                  id="productId"
                  name="productId"
                  type="text"
                  maxLength={128}
                  placeholder="Existing Medusa product id, if you already have one"
                  className={inputClass}
                />
                <p className={hintClass}>
                  Leave blank for a new listing. A pending reference is assigned automatically; no
                  catalogue id is invented on your behalf.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-1 font-serif text-xl font-semibold text-deep-ink">Listing data</h2>
            <p className="mb-4 font-sans text-sm text-muted-ink">
              Attributes, variants and pricing are stored as JSON so the catalogue can evolve
              without a schema change.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="attributes" className={labelClass}>
                  Attributes (JSON object)
                </label>
                <textarea
                  id="attributes"
                  name="attributes"
                  rows={5}
                  className={textareaClass}
                  placeholder={'{"material":"silk","dimensions":"70 x 180 cm","finish":"hand-block printed"}'}
                />
                <p className={hintClass}>Material, dimensions, finish, care — any factual properties buyers should see.</p>
              </div>
              <div>
                <label htmlFor="variants" className={labelClass}>
                  Variants (JSON array)
                </label>
                <textarea
                  id="variants"
                  name="variants"
                  rows={5}
                  className={textareaClass}
                  placeholder={'[{"title":"Default","sku":"STOLE-01","options":{"colour":"indigo"}}]'}
                />
              </div>
              <div>
                <label htmlFor="pricing" className={labelClass}>
                  Pricing (JSON object)
                </label>
                <textarea
                  id="pricing"
                  name="pricing"
                  rows={4}
                  className={textareaClass}
                  placeholder={'{"amount":4500,"currency_code":"inr"}'}
                />
                <p className={hintClass}>State the amount and currency you want the platform to review.</p>
              </div>
              <div>
                <label htmlFor="images" className={labelClass}>
                  Image URLs (one per line)
                </label>
                <textarea
                  id="images"
                  name="images"
                  rows={4}
                  className={textareaClass}
                  placeholder="/uploads/products/9f2c…jpg"
                />
                <p className={hintClass}>
                  Upload images with the platform image uploader and paste the returned URLs here.
                  Only references are stored — this form does not accept file bytes.
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-sindoor px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90"
            >
              Save draft
            </button>
            <Link href="/partner/products" className="font-sans text-sm text-muted-ink hover:text-deep-ink">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
