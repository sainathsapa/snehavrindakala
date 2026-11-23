/**
 * Partner orders — detail (Server Component).
 *
 * Loads a SINGLE group through A47's tenant-scoped `getPartnerGroup(ctx, id)`.
 * A foreign or unknown id yields `null` and we call `notFound()` — no other
 * partner's data is ever rendered, not even a shell around it. Identity comes
 * only from the verified session context; the `id` is the group id from the URL.
 * No financial/payment field is read or displayed.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { getPartnerGroup } from "@/lib/fulfilment/store";
import type {
  AssignmentEvent,
  FulfilmentGroup,
  FulfilmentStatus,
} from "@/lib/fulfilment/types";
import OrderActions from "./order-actions";

export const dynamic = "force-dynamic";

/** Forward progress path; rejected/cancelled are terminal branches, not steps. */
const TIMELINE: FulfilmentStatus[] = [
  "assigned",
  "accepted",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
];

const STATUS_LABELS: Record<FulfilmentStatus, string> = {
  assigned: "Awaiting acceptance",
  accepted: "Accepted",
  packing: "Packing",
  ready_for_dispatch: "Ready for dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function statusLabel(status: FulfilmentStatus): string {
  return STATUS_LABELS[status] ?? String(status).replace(/_/g, " ");
}

/** Timeline entries up to and including the group's current status. */
export function fulfilmentTimeline(status: FulfilmentStatus): FulfilmentStatus[] {
  if (status === "rejected" || status === "cancelled") return ["assigned", status];
  const index = TIMELINE.indexOf(status);
  return index === -1 ? [] : TIMELINE.slice(0, index + 1);
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status: FulfilmentStatus): string {
  if (status === "assigned") return "border-sindoor/20 bg-sindoor/10 text-sindoor";
  if (status === "delivered") return "border-terracotta/20 bg-terracotta/10 text-terracotta";
  if (status === "rejected" || status === "cancelled")
    return "border-sand-border bg-rang-paper text-muted-ink";
  return "border-terracotta/20 bg-terracotta/5 text-terracotta";
}

function Items({ group }: { group: FulfilmentGroup }) {
  const items = Array.isArray(group.items) ? group.items : [];
  if (items.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-ink">No items recorded for this group.</p>
    );
  }
  return (
    <ul className="divide-y divide-sand-border rounded-xl border border-sand-border bg-surface">
      {items.map((item, index) => (
        <li key={`${item?.item_id ?? "item"}-${index}`} className="px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-sans text-sm font-medium text-deep-ink">
              {item?.title || item?.item_id || `Item ${index + 1}`}
            </p>
            <p className="font-sans text-xs text-muted-ink">
              Quantity: {Number(item?.quantity) || 0}
            </p>
          </div>
          <p className="mt-1 break-all font-sans text-xs text-muted-ink">
            Line {item?.item_id || "—"}
            {item?.variant_id ? ` · Variant ${item.variant_id}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ status }: { status: FulfilmentStatus }) {
  const steps = fulfilmentTimeline(status);
  if (steps.length === 0) {
    return <p className="font-sans text-sm text-muted-ink">No status recorded.</p>;
  }
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isCurrent = index === steps.length - 1;
        return (
          <li key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                  isCurrent ? "border-sindoor bg-sindoor" : "border-sand-border bg-white"
                }`}
              />
              {index < steps.length - 1 && (
                <span className="my-1 w-px flex-1 bg-sand-border" />
              )}
            </div>
            <div className="pb-4">
              <p
                className={`font-sans text-sm ${
                  isCurrent ? "font-semibold text-deep-ink" : "text-muted-ink"
                }`}
              >
                {statusLabel(step)}
              </p>
              {isCurrent && (
                <p className="font-sans text-xs text-sindoor">Current status</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function History({ events }: { events: AssignmentEvent[] }) {
  if (!Array.isArray(events) || events.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-ink">
        No assignment history recorded yet.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {events.map((event, index) => (
        <li key={`${event.at}-${index}`} className="rounded-xl border border-sand-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-sans text-sm font-medium text-deep-ink">
              {event.from ? statusLabel(event.from) : "New assignment"} →{" "}
              {statusLabel(event.to)}
            </p>
            <p className="font-sans text-xs text-muted-ink">{formatDateTime(event.at)}</p>
          </div>
          <p className="mt-1 font-sans text-xs text-muted-ink">
            {event.action || "status_change"} · by {event.actor || "unknown"}
          </p>
          {event.note && (
            <p className="mt-2 whitespace-pre-wrap font-sans text-sm text-deep-ink">
              {event.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export default async function PartnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePartnerPermission("orders:read");
  if (!ctx) redirect("/partner/login");

  const { id } = await params;
  const group = await getPartnerGroup(ctx, id);
  // Foreign / unknown id: return not-found UI, never another tenant's data.
  if (!group) notFound();

  const history = Array.isArray(group.assignment_history) ? group.assignment_history : [];
  const canWrite = partnerHasPermission(ctx.role, "orders:write");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/partner/orders" className="font-sans text-sm text-sindoor hover:underline">
          ← Back to orders
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
              Order #{group.customer_order_id || group.id}
            </h1>
            <p className="mt-1 font-sans text-sm text-muted-ink">
              Fulfilment group {group.id}
            </p>
          </div>
          <span
            className={`inline-flex rounded-full border px-3 py-1 font-sans text-xs font-medium ${statusClasses(group.status)}`}
          >
            {statusLabel(group.status)}
          </span>
        </div>
        <p className="mt-3 font-sans text-sm text-muted-ink">
          Deadline: {formatDateTime(group.fulfilment_deadline)}
        </p>
      </div>

      <section className="rounded-xl border border-sand-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-deep-ink">Actions</h2>
        <OrderActions groupId={group.id} status={group.status} canWrite={canWrite} />
        <p className="mt-4 font-sans text-xs text-muted-ink">
          Actions use only operational data. Monetary and billing information is
          never displayed or submitted here.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold text-deep-ink">Items</h2>
        <Items group={group} />
      </section>

      <section className="rounded-xl border border-sand-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-deep-ink">
          Status timeline
        </h2>
        <Timeline status={group.status} />
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold text-deep-ink">
          Assignment history
        </h2>
        <History events={history} />
      </section>
    </div>
  );
}
