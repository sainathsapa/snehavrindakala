import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  listPartnerShipments,
  type PartnerShipmentRow,
} from "@/lib/partner-portal/shipments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shipments — Partner portal — SnehaVrinda Kala",
};

function itemCount(items: unknown): string {
  if (Array.isArray(items)) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  return "—";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-rang-paper px-2.5 py-1 font-sans text-xs text-deep-ink">
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function PartnerShipmentsPage() {
  const ctx = await requirePartnerPermission("shipments:read");
  if (!ctx) redirect("/partner/login");

  const shipments: PartnerShipmentRow[] = await listPartnerShipments(ctx);

  return (
    <main className="min-h-screen bg-rang-paper py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
              Partner portal
            </p>
            <h1 className="mt-1 text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Shipments
            </h1>
            <p className="mt-1 text-sm font-sans text-muted-ink">
              Courier and tracking details for orders you are fulfilling.
            </p>
          </div>
          <nav className="flex gap-4 font-sans text-sm">
            <Link href="/partner/shipments" className="font-medium text-sindoor">
              Shipments
            </Link>
            <Link href="/partner/customers" className="text-muted-ink hover:text-sindoor">
              Fulfilment customers
            </Link>
          </nav>
        </div>

        <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
          <table className="w-full text-left">
            <thead className="border-b border-sand-border bg-rang-paper/60">
              <tr>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">AWB</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Courier</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Status</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Order</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Items</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length > 0 ? (
                shipments.map((s) => (
                  <tr key={s.shipment_record_id || s.group_id} className="border-b border-sand-border/60 last:border-0">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {s.awb_code || "—"}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {s.courier_name || s.courier_service || "—"}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm">
                      <StatusPill status={s.shipment_status || s.fulfilment_status || "unknown"} />
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      <span title={s.order_id}>#{String(s.order_id).slice(-8)}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {itemCount(s.items)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center font-sans text-sm text-muted-ink">
                    No shipments have been created for your orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
