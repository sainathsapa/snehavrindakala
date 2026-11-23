import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePartnerContext, requirePartnerPermission } from "@/lib/partner/context";
import {
  getProduct,
  readProductDetails,
  submitForApproval,
  updateSubmission,
  EDITABLE_STATUSES,
  SUBMISSION_STATUS_LABELS,
  type PartnerProductRow,
  type ProductDetails,
  type SubmissionStatus,
} from "@/lib/partner-portal/products";

export const dynamic = "force-dynamic";

async function editingContext() {
  const ctx = await requirePartnerPermission("products:write");
  if (!ctx) redirect("/partner/login");
  return ctx;
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function jsonField<T>(formData: FormData, name: string): T | undefined {
  const raw = formText(formData, name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }
}

async function saveAction(formData: FormData) {
  "use server";
  const ctx = await editingContext();
  const id = formText(formData, "id");
  let message: string | null = null;
  try {
    await updateSubmission(ctx, id, {
      title: formText(formData, "title"),
      description: formText(formData, "description"),
      attributes: jsonField<Record<string, unknown>>(formData, "attributes"),
      variants: jsonField<Array<Record<string, unknown>>>(formData, "variants"),
      pricing: jsonField<Record<string, unknown>>(formData, "pricing"),
      images: formText(formData, "images")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
  } catch (err: any) {
    message = err?.message ?? "Could not save changes.";
  }
  const target = `/partner/products/${encodeURIComponent(id)}`;
  if (message) redirect(`${target}?error=${encodeURIComponent(message)}`);
  redirect(`${target}?notice=${encodeURIComponent("Draft updated.")}`);
}

async function submitAction(formData: FormData) {
  "use server";
  const ctx = await editingContext();
  const id = formText(formData, "id");
  let message: string | null = null;
  try {
    await submitForApproval(ctx, id);
  } catch (err: any) {
    message = err?.message ?? "Could not submit this product.";
  }
  const target = `/partner/products/${encodeURIComponent(id)}`;
  if (message) redirect(`${target}?error=${encodeURIComponent(message)}`);
  redirect(`${target}?notice=${encodeURIComponent("Submitted for platform review.")}`);
}

function statusBadgeClass(status: SubmissionStatus): string {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "submitted":
      return "bg-amber-100 text-amber-900";
    case "rejected":
      return "bg-terracotta/10 text-terracotta";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function displayValue(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function History({ row }: { row: PartnerProductRow }) {
  const events: Array<{ label: string; at: string | null; note?: string; pending?: boolean }> = [
    { label: "Submission created", at: row.created_at },
  ];
  if (row.submitted_at) {
    events.push({ label: "Submitted for platform review", at: row.submitted_at });
  }
  if (row.reviewed_at) {
    const label =
      row.submission_status === "approved"
        ? "Approved by platform"
        : row.submission_status === "rejected"
          ? "Returned with changes requested"
          : "Reviewed by platform";
    events.push({
      label,
      at: row.reviewed_at,
      note: row.reviewed_by ? `Reviewer: ${row.reviewed_by}` : undefined,
    });
  } else if (row.submission_status === "submitted") {
    events.push({ label: "Awaiting platform review", at: null, pending: true });
  } else if (row.submission_status === "draft") {
    events.push({ label: "Not yet submitted", at: null, pending: true });
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => (
        <li key={`${event.label}-${index}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                event.pending
                  ? "border-sand-border bg-white"
                  : "border-sindoor bg-sindoor"
              }`}
            />
            {index < events.length - 1 && (
              <span className="my-1 w-px flex-1 bg-sand-border" />
            )}
          </div>
          <div className="pb-5">
            <p className={`font-sans text-sm font-medium ${event.pending ? "text-muted-ink" : "text-deep-ink"}`}>
              {event.label}
            </p>
            <p className="font-sans text-xs text-muted-ink">
              {event.pending ? "Pending" : formatDate(event.at)}
            </p>
            {event.note && <p className="font-sans text-xs text-muted-ink">{event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function KeyValues({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="font-sans text-sm text-muted-ink">None recorded.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map(([key, item]) => (
        <div key={key} className="rounded-lg border border-sand-border bg-white px-3 py-2">
          <dt className="font-sans text-xs uppercase tracking-wider text-muted-ink">{key}</dt>
          <dd className="mt-1 break-words font-sans text-sm text-deep-ink">{displayValue(item)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditForm({
  row,
  details,
}: {
  row: PartnerProductRow;
  details: ProductDetails;
}) {
  const textareaClass =
    "w-full rounded-md border border-sand-border bg-white px-3 py-2 font-mono text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";
  const inputClass =
    "w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";
  const labelClass = "mb-2 block font-sans text-sm font-medium text-deep-ink";
  const imagesValue = details.images
    .map((image) => (typeof image === "string" ? image : image?.url ?? ""))
    .filter(Boolean)
    .join("\n");

  return (
    <details className="rounded-xl border border-sand-border bg-surface p-6">
      <summary className="cursor-pointer font-serif text-xl font-semibold text-deep-ink">
        Edit submission
      </summary>
      <form action={saveAction} className="mt-6 space-y-4">
        <input type="hidden" name="id" value={row.id} />
        <div>
          <label htmlFor="title" className={labelClass}>Title</label>
          <input id="title" name="title" type="text" required maxLength={200} defaultValue={details.title} className={inputClass} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={details.description} className={`${textareaClass} font-sans`} />
        </div>
        <div>
          <label htmlFor="attributes" className={labelClass}>Attributes (JSON object)</label>
          <textarea id="attributes" name="attributes" rows={5} defaultValue={JSON.stringify(details.attributes, null, 2)} className={textareaClass} />
        </div>
        <div>
          <label htmlFor="variants" className={labelClass}>Variants (JSON array)</label>
          <textarea id="variants" name="variants" rows={5} defaultValue={JSON.stringify(details.variants, null, 2)} className={textareaClass} />
        </div>
        <div>
          <label htmlFor="pricing" className={labelClass}>Pricing (JSON object)</label>
          <textarea id="pricing" name="pricing" rows={4} defaultValue={JSON.stringify(details.pricing, null, 2)} className={textareaClass} />
        </div>
        <div>
          <label htmlFor="images" className={labelClass}>Image URLs (one per line)</label>
          <textarea id="images" name="images" rows={4} defaultValue={imagesValue} className={textareaClass} />
          <p className="mt-1 font-sans text-xs text-muted-ink">References only — upload files with the platform image uploader first.</p>
        </div>
        <button type="submit" className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90">
          Save changes
        </button>
      </form>
    </details>
  );
}

export default async function PartnerProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  const { id } = await params;
  const row = await getProduct(ctx, id);
  if (!row) notFound();

  const { error, notice } = await searchParams;
  const details = readProductDetails(row);
  const editable = EDITABLE_STATUSES.includes(row.submission_status);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/partner/products" className="font-sans text-sm text-sindoor hover:underline">
            ← Back to submissions
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
                {details.title}
              </h1>
              <p className="font-sans text-sm text-muted-ink">
                Submission #{row.id.slice(-8)} · Product reference {row.product_id}
              </p>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 font-sans text-xs font-medium ${statusBadgeClass(row.submission_status)}`}>
              {SUBMISSION_STATUS_LABELS[row.submission_status] ?? row.submission_status}
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-3 font-sans text-sm text-terracotta">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 font-sans text-sm text-green-800">
            {notice}
          </div>
        )}

        {row.submission_status === "rejected" && (
          <section className="mb-6 rounded-xl border border-terracotta/30 bg-terracotta/10 p-6">
            <h2 className="font-serif text-lg font-semibold text-terracotta">Changes requested</h2>
            <p className="mt-2 whitespace-pre-wrap font-sans text-sm text-deep-ink">
              {row.rejection_reason || "No reason was recorded with this review."}
            </p>
            {row.reviewed_at && (
              <p className="mt-2 font-sans text-xs text-muted-ink">
                Reviewed {formatDate(row.reviewed_at)}
                {row.reviewed_by ? ` by ${row.reviewed_by}` : ""}
              </p>
            )}
            <p className="mt-3 font-sans text-sm text-muted-ink">
              You can edit this submission and submit it again for review.
            </p>
          </section>
        )}

        {editable && (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-amber-900">
                {row.submission_status === "draft" ? "Draft not yet submitted" : "Ready for resubmission"}
              </h2>
              <p className="mt-1 font-sans text-sm text-amber-900/80">
                Submitting locks editing until the platform reviews your listing.
              </p>
            </div>
            <form action={submitAction}>
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90">
                Submit for approval
              </button>
            </form>
          </section>
        )}

        <section className="mb-6 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-deep-ink">Submission details</h2>
          {details.description ? (
            <p className="mb-6 whitespace-pre-wrap font-sans text-sm leading-relaxed text-deep-ink">
              {details.description}
            </p>
          ) : (
            <p className="mb-6 font-sans text-sm text-muted-ink">No description provided.</p>
          )}
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">Attributes</h3>
              <KeyValues value={details.attributes} />
            </div>
            <div>
              <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">Variants</h3>
              {details.variants.length === 0 ? (
                <p className="font-sans text-sm text-muted-ink">None recorded.</p>
              ) : (
                <div className="space-y-3">
                  {details.variants.map((variant, index) => (
                    <div key={index} className="rounded-lg border border-sand-border bg-white p-3">
                      <KeyValues value={variant} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">Pricing</h3>
              <KeyValues value={details.pricing} />
            </div>
            <div>
              <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">Images</h3>
              {details.images.length === 0 ? (
                <p className="font-sans text-sm text-muted-ink">No image references attached.</p>
              ) : (
                <ul className="space-y-2">
                  {details.images.map((image, index) => {
                    const url = typeof image === "string" ? image : image?.url ?? "";
                    const safe = url.startsWith("/") || /^https?:\/\//i.test(url);
                    return (
                      <li key={index} className="font-sans text-sm">
                        {safe ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sindoor hover:underline">
                            {url}
                          </a>
                        ) : (
                          <span className="text-muted-ink">Invalid image reference</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-deep-ink">History</h2>
          <History row={row} />
        </section>

        {editable && <EditForm row={row} details={details} />}

        {!editable && (
          <p className="font-sans text-sm text-muted-ink">
            {row.submission_status === "submitted"
              ? "This submission is with the platform for review and cannot be edited. If changes are requested, it will return here for editing."
              : "Approved submissions are immutable here. Contact platform support to make catalogue changes."}
          </p>
        )}
      </div>
    </main>
  );
}
