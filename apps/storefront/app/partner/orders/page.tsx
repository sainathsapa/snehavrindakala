/**
 * Partner orders — list (Server Component).
 *
 * Reads ONLY the authenticated partner's fulfilment groups through A47's
 * tenant-scoped `listPartnerGroups(ctx)`. The tenant id is derived from the
 * verified session context (requirePartnerPermission), never from the request.
 * The view is strictly operational: no monetary, billing, commission or
 * settlement data is fetched or displayed.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import { listPartnerGroups } from "@/lib/fulfilment/store";
import type { FulfilmentGroup, FulfilmentStatus } from "@/lib/fulfilment/types";

export const dynamic = "force-dynamic";

/** Display order of the status buckets (the order of the fulfilment machine). */
const STATUS_ORDER: FulfilmentStatus[] = [
  "assigned",
  "accepted",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "rejected",
  "cancelled",
];

/** Human-friendly, stable labels shown in the UI. */
export const STATUS_LABELS: Record<FulfilmentStatus, string> = {
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

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusClasses(status: FulfilmentStatus): string {
  if (status === "assigned") return "border-sindoor/20 bg-sindoor/10 text-sindoor";
  if (status === "delivered") return "border-terracotta/20 bg-terracotta/10 text-terracotta";
  if (status === "rejected" || status === "cancelled")
    return "border-sand-border bg-rang-paper text-muted-ink";
  return "border-terracotta/20 bg-terracotta/5 text-terracotta";
}

function itemSummary(group: FulfilmentGroup): string {
  const items = Array.isArray(group.items) ? group.items : [];
  if (items.length === 0) return "No items recorded";
  const titles = items
    .map((item) => (typeof item?.title === "string" ? item.title.trim() : ""))
    .filter(Boolean);
  if (titles.length === 0) {
    return `${items.length} item${items.length === 1 ? "" : "s"}`;
  }
  const shown = titles.slice(0, 3).join(", ");
  const extra = titles.length > 3 ? ` +${titles.length - 3} more` : "";
  return `${shown}${extra}`;
}

function GroupRow({ group }: { group: FulfilmentGroup }) {
  const items = Array.isArray(group.items) ? group.items : [];
  const quantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-sans text-sm font-semibold text-deep-ink">
          Order #{group.customer_order_id || group.id}
        </p>
        <p className="mt-1 truncate font-sans text-sm text-muted-ink">
          {itemSummary(group)} · {items.length} line{items.length === 1 ? "" : "s"}
          {quantity > 0 ? ` · ${quantity} unit${quantity === 1 ? "" : "s"}` : ""}
        </p>
        <p className="mt-1 font-sans text-xs text-muted-ink">
          Deadline: {formatDate(group.fulfilment_deadline)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 font-sans text-xs font-medium ${statusClasses(group.status)}`}
        >
          {statusLabel(group.status)}
        </span>
        <Link
          href={`/partner/orders/${encodeURIComponent(group.id)}`}
          className="font-sans text-sm font-medium text-sindoor hover:underline"
          aria-label={`View order ${group.customer_order_id || group.id}`}
        >
          View details →
        </Link>
      </div>
    </li>
  );
}

function StatusSection({
  status,
  groups,
}: {
  status: FulfilmentStatus;
  groups: FulfilmentGroup[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-sand-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-sand-border bg-rang-paper/50 px-4 py-3">
        <h2 className="font-serif text-base font-semibold text-deep-ink">
          {statusLabel(status)}
        </h2>
        <span className="rounded-full bg-surface px-2.5 py-0.5 font-sans text-xs font-medium text-muted-ink">
          {groups.length}
        </span>
      </div>
      <ul className="divide-y divide-sand-border">
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} />
        ))}
      </ul>
    </section>
  );
}

export default async function PartnerOrdersPage() {
  const ctx = await requirePartnerPermission("orders:read");
  if (!ctx) redirect("/partner/login");

  const groups = await listPartnerGroups(ctx);

  const byStatus = new Map<FulfilmentStatus, FulfilmentGroup[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const group of groups) {
    const bucket = byStatus.get(group.status);
    if (bucket) bucket.push(group);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-deep-ink">Orders</h1>
        <p className="mt-1 font-sans text-sm text-muted-ink">
          Fulfilment groups assigned to you, grouped by status. Select an order to
          view its items and update its progress.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sand-border bg-surface px-6 py-10 text-center">
          <p className="font-serif text-base font-semibold text-deep-ink">No orders yet</p>
          <p className="mx-auto mt-1 max-w-md font-sans text-sm text-muted-ink">
            Orders containing your products will appear here once a customer checks
            out. Nothing is shown until there is real data.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {STATUS_ORDER.filter((status) => (byStatus.get(status)?.length ?? 0) > 0).map(
            (status) => (
              <StatusSection
                key={status}
                status={status}
                groups={byStatus.get(status) ?? []}
              />
            )
          )}
        </div>
      )}

      <p className="font-sans text-xs text-muted-ink">
        Only fulfilment information is shown here. Monetary and billing details are
        never displayed in the partner portal.
      </p>
    </div>
  );
}
