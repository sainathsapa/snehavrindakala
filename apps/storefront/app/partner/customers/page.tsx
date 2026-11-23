import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  fulfilmentCustomers,
  type FulfilmentCustomerView,
} from "@/lib/partner-portal/shipments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fulfilment customers — Partner portal — SnehaVrinda Kala",
};

function itemCount(items: unknown): string {
  if (Array.isArray(items)) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  return "—";
}

function contactSummary(contact: unknown): string {
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) return "—";
  const c = contact as Record<string, unknown>;
  const name = c.name || c.full_name || c.recipient;
  const city = c.city || c.state || c.country;
  if (name && city) return `${name} — ${city}`;
  return String(name || city || "—");
}

export default async function PartnerCustomersPage() {
  const ctx = await requirePartnerPermission("customers:read");
  if (!ctx) redirect("/partner/login");

  const customers: FulfilmentCustomerView[] = await fulfilmentCustomers(ctx);

  return (
    <main className="min-h-screen bg-rang-paper py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
              Partner portal
            </p>
            <h1 className="mt-1 text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Fulfilment customers
            </h1>
            <p className="mt-1 text-sm font-sans text-muted-ink">
              Only the context you need to pack and dispatch an order.
            </p>
          </div>
          <nav className="flex gap-4 font-sans text-sm">
            <Link href="/partner/shipments" className="text-muted-ink hover:text-sindoor">
              Shipments
            </Link>
            <Link href="/partner/customers" className="font-medium text-sindoor">
              Fulfilment customers
            </Link>
          </nav>
        </div>

        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <p className="font-sans text-sm text-muted-ink">
            <span className="font-medium text-deep-ink">Privacy note:</span> sensitive
            customer and payment data — including email addresses, phone numbers,
            billing addresses, payment methods and invoices — is intentionally
            withheld from partners. Only the fulfilment context below (order,
            items, status and delivery name/area) is shown so you can pack and
            dispatch the order.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
          <table className="w-full text-left">
            <thead className="border-b border-sand-border bg-rang-paper/60">
              <tr>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Group</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Order</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Items</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Status</th>
                <th className="px-6 py-3 font-sans text-xs font-medium uppercase tracking-wide text-muted-ink">Delivery contact</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.group_id} className="border-b border-sand-border/60 last:border-0">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      <span title={c.group_id}>#{String(c.group_id).slice(-8)}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      <span title={c.customer_order_id}>#{String(c.customer_order_id).slice(-8)}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {itemCount(c.items)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {c.status.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {contactSummary(c.shipping_contact)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center font-sans text-sm text-muted-ink">
                    No orders are currently awaiting fulfilment.
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
