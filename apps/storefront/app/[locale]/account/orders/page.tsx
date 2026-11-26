import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuthToken, getCurrentCustomer } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { listAccountOrders } from "@/lib/account-orders";
import { getOrderShipment } from "@/lib/shipping/store";
import { shipmentStatusLabel, shipmentStatusClasses } from "@/lib/shipping/status-label";
import { CancelOrderForm } from "./cancel-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your orders — SnehaVrinda Kala",
  robots: { index: false, follow: false },
};

/**
 * Every order, in one place.
 *
 * The account page carried a short recent-orders block, which answered "did the
 * thing I bought go through?" and nothing else. This is the page a returning
 * buyer needs: all of them, what each contained, where each has got to, and the
 * one action they are entitled to take themselves — cancel, while nothing has
 * shipped.
 */
export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  const token = await getAuthToken();
  if (!customer?.email || !token) {
    redirect("/account/login?next=/account/orders");
  }

  const t = await getTranslations("accountOrders");

  let orders: any[] = [];
  try {
    const result = await medusa.listCustomerOrders(token, { limit: 50 });
    orders = await listAccountOrders(result.orders ?? [], customer.email || "", 50);
  } catch (error) {
    console.error("Failed to load orders", error);
  }

  const shipments = await Promise.all(
    orders.map(async (order) => {
      try {
        return await getOrderShipment(order.id);
      } catch {
        return null;
      }
    })
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/account"
        className="font-sans text-sm text-sindoor hover:underline"
      >
        ← {t("back")}
      </Link>

      <h1 className="mt-4 font-serif text-3xl text-deep-ink">{t("title")}</h1>
      <p className="mt-2 max-w-xl font-sans text-sm text-muted-ink">{t("intro")}</p>

      {orders.length === 0 ? (
        <div className="mt-10 border border-sand-border bg-surface p-8 text-center">
          <p className="font-serif text-lg text-deep-ink">{t("empty")}</p>
          <p className="mx-auto mt-2 max-w-sm font-sans text-sm text-muted-ink">
            {t("emptyHint")}
          </p>
          <Link
            href="/shop"
            className="mt-5 inline-flex rounded-md bg-sindoor px-5 py-2.5 font-sans text-sm font-medium text-rang-paper hover:bg-sindoor/90"
          >
            {t("browse")}
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-5">
          {orders.map((order: any, index: number) => {
            const shipment = shipments[index];
            const status = shipment?.status ? shipmentStatusLabel(shipment.status) : null;
            const items = (order.items ?? []) as any[];
            const placed = order.created_at
              ? new Date(order.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "";

            return (
              <li key={order.id} className="border border-sand-border bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg text-deep-ink">
                      #{order.display_id ?? order.id.slice(-6)}
                    </p>
                    <p className="font-sans text-xs uppercase tracking-[0.14em] text-muted-ink">
                      {placed}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {status && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider ${shipmentStatusClasses(
                          status.tone
                        )}`}
                      >
                        {status.label}
                      </span>
                    )}
                    <span className="font-sans text-sm text-deep-ink">
                      {formatMoney(order.total, order.currency_code)}
                    </span>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 border-t border-sand-border pt-3">
                  {items.map((item: any) => (
                    <li key={item.id} className="font-sans text-sm text-muted-ink">
                      {item.title ?? item.product_title}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <Link
                    href={`/order/${order.id}`}
                    className="font-sans text-sm text-sindoor hover:underline"
                  >
                    {t("view")}
                  </Link>
                  <Link
                    href="/track"
                    className="font-sans text-sm text-sindoor hover:underline"
                  >
                    {t("track")}
                  </Link>
                  <CancelOrderForm
                    orderId={order.id}
                    cancellable={!shipment?.awb_code}
                    labels={{
                      cancel: t("cancel"),
                      confirm: t("cancelConfirm"),
                      working: t("cancelling"),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function formatMoney(total: number | undefined, currency: string | undefined) {
  if (total == null) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "inr").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(total / 100);
}
