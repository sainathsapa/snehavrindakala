/**
 * Partner portal — inventory (server component, read only).
 *
 * Identity and permission come from the signed partner session, never from the
 * URL. If the session is missing/invalid or the role lacks `inventory:read`, the
 * visitor is redirected to partner sign-in. All data is fetched through the
 * tenant-scoped partner-portal inventory module.
 */

import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  getStockExceptions,
  listPartnerInventory,
  summariseInventory,
  type StockExceptionRow,
} from "@/lib/partner-portal/inventory";

export const dynamic = "force-dynamic";

function displayTitle(title: string | null, id: string): string {
  return title && title.trim() ? title : id;
}

function exceptionLabel(exception: StockExceptionRow): string {
  switch (exception.kind) {
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return "Low stock";
    case "expired_reservation":
      return "Stale reservation";
    default:
      return exception.kind;
  }
}

export default async function PartnerInventoryPage() {
  const ctx = await requirePartnerPermission("inventory:read");
  if (!ctx) redirect("/partner/login");

  const [rows, exceptions] = await Promise.all([
    listPartnerInventory(ctx),
    getStockExceptions(ctx),
  ]);
  const summary = summariseInventory(rows);

  const summaryCards = [
    { label: "Variants tracked", value: summary.variants },
    { label: "Available units", value: summary.available },
    { label: "Reserved units", value: summary.reserved },
    { label: "Sold units", value: summary.sold },
    { label: "Out of stock", value: summary.outOfStock },
    { label: "Low stock", value: summary.lowStock },
  ];

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Inventory
          </h1>
          <p className="text-muted-ink font-sans">
            Live stock for products owned by your partner account. Read-only.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-sand-border bg-surface p-4"
            >
              <p className="text-xs font-sans uppercase tracking-wider text-muted-ink">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-serif font-semibold text-deep-ink">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-8 rounded-xl border border-sand-border bg-surface overflow-hidden">
          <h2 className="px-6 py-4 text-lg font-serif font-semibold text-deep-ink">
            Stock by product &amp; variant
          </h2>
          {rows.length === 0 ? (
            <p className="px-6 pb-8 font-sans text-sm text-muted-ink">
              No tracked inventory yet. Stock appears here once a variant for
              your approved product has been initialised by the platform.
            </p>
          ) : (
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-rang-paper/40">
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Product
                  </th>
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Variant
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    On hand
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Reserved
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Available
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {rows.map((row) => (
                  <tr key={row.variant_id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {displayTitle(row.product_title, row.product_id)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {displayTitle(row.variant_title, row.variant_id)}
                    </td>
                    <td className="px-6 py-4 text-right font-sans text-sm text-deep-ink">
                      {row.on_hand}
                    </td>
                    <td className="px-6 py-4 text-right font-sans text-sm text-deep-ink">
                      {row.reserved}
                    </td>
                    <td className="px-6 py-4 text-right font-sans text-sm text-muted-ink">
                      {row.sold}
                    </td>
                    <td className="px-6 py-4 text-right font-sans text-sm font-medium text-deep-ink">
                      {row.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <h2 className="px-6 py-4 text-lg font-serif font-semibold text-deep-ink">
            Exceptions
          </h2>
          {exceptions.length === 0 ? (
            <p className="px-6 pb-8 font-sans text-sm text-muted-ink">
              No stock exceptions. Everything tracked is above the low-stock
              threshold and has no stale reservations.
            </p>
          ) : (
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-rang-paper/40">
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Issue
                  </th>
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Product
                  </th>
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Variant
                  </th>
                  <th className="px-6 py-3 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {exceptions.map((exception, index) => (
                  <tr
                    key={`${exception.kind}-${exception.variant_id}-${
                      exception.reservation_id ?? index
                    }`}
                    className="hover:bg-rang-paper/50"
                  >
                    <td className="px-6 py-4 font-sans text-sm font-medium text-sindoor">
                      {exceptionLabel(exception)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {displayTitle(exception.product_title, exception.product_id)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {displayTitle(exception.variant_title, exception.variant_id)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {exception.kind === "expired_reservation"
                        ? `Reservation ${exception.reservation_id ?? ""} (${
                            exception.reservation_status ?? "stale"
                          }) expired ${
                            exception.expires_at
                              ? new Date(String(exception.expires_at)).toLocaleString()
                              : "—"
                          }`
                        : `${exception.available ?? 0} available`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
