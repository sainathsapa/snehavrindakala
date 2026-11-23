import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  SUBMISSION_STATUS_LABELS,
  type SubmissionStatus,
} from "@/lib/partner-portal/products";
import {
  listSubmissionTimelines,
  type SubmissionTimeline,
  type SubmissionTimelineStatus,
} from "@/lib/partner-portal/submissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product submissions — Partner portal — SnehaVrinda Kala",
};

/** Human label for a status, falling back to the raw value for unknown states. */
function statusLabel(status: SubmissionStatus): string {
  return SUBMISSION_STATUS_LABELS[status] ?? status;
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

function dotClass(status: SubmissionTimelineStatus): string {
  switch (status) {
    case "approved":
      return "bg-green-600";
    case "rejected":
      return "bg-terracotta";
    case "submitted":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function TimelineCard({ timeline }: { timeline: SubmissionTimeline }) {
  return (
    <article className="rounded-xl border border-sand-border bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-deep-ink">{timeline.title}</h2>
          <p className="mt-0.5 font-sans text-xs text-muted-ink" title={timeline.productId}>
            Ref #{timeline.submissionId.slice(-8)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 font-sans text-xs font-medium ${statusBadgeClass(
            timeline.currentStatus
          )}`}
        >
          {statusLabel(timeline.currentStatus)}
        </span>
      </div>

      {timeline.rejectionReason && timeline.currentStatus === "rejected" && (
        <p className="mb-5 rounded-md border border-terracotta/20 bg-terracotta/5 px-4 py-3 font-sans text-sm text-terracotta">
          <span className="font-medium">Changes requested:</span> {timeline.rejectionReason}
        </p>
      )}

      <ol className="relative ml-2 border-l border-sand-border pl-6">
        {timeline.events.map((event) => (
          <li key={event.id} className="relative pb-6 last:pb-0">
            <span
              className={`absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${dotClass(
                event.status
              )}`}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-sans text-sm font-medium text-deep-ink">{event.label}</p>
              <time className="font-sans text-xs text-muted-ink" dateTime={event.at ?? undefined}>
                {formatTimestamp(event.at)}
              </time>
            </div>
            <p className="mt-1 font-sans text-sm text-muted-ink">{event.description}</p>
            {event.reason && (
              <p className="mt-1 font-sans text-xs italic text-terracotta">
                Reviewer note: {event.reason}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex gap-4 border-t border-sand-border pt-4 font-sans text-sm">
        <Link
          href={`/partner/products/${timeline.submissionId}`}
          className="text-sindoor hover:underline"
        >
          View submission
        </Link>
        <Link href="/partner/products" className="text-muted-ink hover:text-deep-ink">
          Products
        </Link>
      </div>
    </article>
  );
}

export default async function PartnerSubmissionsPage() {
  // Tenant comes only from the verified session; no client partner id is read.
  const ctx = await requirePartnerPermission("products:read");
  if (!ctx) redirect("/partner/login");

  const timelines = await listSubmissionTimelines(ctx);

  return (
    <main className="min-h-screen bg-rang-paper py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-sindoor">
              Partner portal
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-deep-ink">
              Product submissions
            </h1>
            <p className="mt-1 font-sans text-sm text-muted-ink">
              The full history of each submission — from draft to review decision, including
              reviewer notes and dates.
            </p>
          </div>
          <nav className="flex gap-4 font-sans text-sm">
            <Link href="/partner/submissions" className="font-medium text-sindoor">
              Submissions
            </Link>
            <Link href="/partner/products" className="text-muted-ink hover:text-sindoor">
              Products
            </Link>
          </nav>
        </div>

        {timelines.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface px-6 py-12 text-center">
            <p className="font-sans text-sm text-muted-ink">
              No submissions yet. Create a product to start building your catalogue history.
            </p>
            <Link
              href="/partner/products/new"
              className="mt-4 inline-block rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90"
            >
              New submission
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {timelines.map((timeline) => (
              <TimelineCard key={timeline.submissionId} timeline={timeline} />
            ))}
          </div>
        )}

        <p className="mt-6 font-sans text-xs text-muted-ink">
          Showing {timelines.length} submission{timelines.length === 1 ? "" : "s"}. This is a read-only
          history; edit drafts and returned submissions from the Products page.
        </p>
      </div>
    </main>
  );
}
