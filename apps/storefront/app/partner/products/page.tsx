import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import {
  listProducts,
  readProductDetails,
  SUBMISSION_STATUS_LABELS,
  type SubmissionStatus,
} from "@/lib/partner-portal/products";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Changes requested" },
];

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

function priceLabel(pricing: Record<string, unknown>): string {
  if (pricing.amount === undefined || pricing.amount === null || pricing.amount === "") {
    return "Not set";
  }
  const currency =
    typeof pricing.currency_code === "string" && pricing.currency_code
      ? ` ${pricing.currency_code.toUpperCase()}`
      : "";
  return `${String(pricing.amount)}${currency}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default async function PartnerProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  const { status: requestedStatus } = await searchParams;
  const status =
    requestedStatus && FILTERS.some((f) => f.value === requestedStatus)
      ? requestedStatus
      : "all";
  const products = await listProducts(ctx);
  const visible =
    status === "all"
      ? products
      : products.filter((p) => p.submission_status === status);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
              Product submissions
            </h1>
            <p className="font-sans text-muted-ink">
              Manage your catalogue submissions and their approval status.
            </p>
          </div>
          <Link
            href="/partner/products/new"
            className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90"
          >
            New submission
          </Link>
        </div>

        <form method="get" className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-52 flex-1">
              <label
                htmlFor="status"
                className="mb-2 block font-sans text-xs font-medium uppercase tracking-wider text-muted-ink"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-sand-border bg-white px-4 py-2 font-sans text-sm text-deep-ink transition-colors hover:bg-rang-paper"
            >
              Apply filter
            </button>
            <Link
              href="/partner/products"
              className="rounded-md px-3 py-2 font-sans text-sm text-muted-ink hover:text-deep-ink"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr>
                <th className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Submission
                </th>
                <th className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Product reference
                </th>
                <th className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Status
                </th>
                <th className="px-6 py-4 text-right font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Pricing
                </th>
                <th className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  Created
                </th>
                <th className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="font-sans text-muted-ink">
                      No submissions found. Create one to start building your catalogue.
                    </p>
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const details = readProductDetails(row);
                  const badge = (
                    <span
                      className={`inline-flex rounded-full px-2 py-1 font-sans text-xs font-medium ${statusBadgeClass(row.submission_status)}`}
                    >
                      {SUBMISSION_STATUS_LABELS[row.submission_status] ?? row.submission_status}
                    </span>
                  );
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-rang-paper/50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/partner/products/${row.id}`}
                          className="font-sans text-sm font-medium text-sindoor hover:underline"
                        >
                          {details.title}
                        </Link>
                        <p className="font-sans text-xs text-muted-ink">#{row.id.slice(-8)}</p>
                        {row.submission_status === "rejected" && row.rejection_reason && (
                          <p className="mt-1 font-sans text-xs text-terracotta" title={row.rejection_reason}>
                            Changes requested
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {row.product_id}
                      </td>
                      <td className="px-6 py-4">{badge}</td>
                      <td className="px-6 py-4 text-right font-sans text-sm text-deep-ink">
                        {priceLabel(details.pricing)}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/partner/products/${row.id}`}
                          className="font-sans text-sm text-sindoor hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 font-sans text-xs text-muted-ink">
          Showing {visible.length} of {products.length} submissions. Editing is available for drafts
          and submissions returned for changes.
        </p>
      </div>
    </main>
  );
}
