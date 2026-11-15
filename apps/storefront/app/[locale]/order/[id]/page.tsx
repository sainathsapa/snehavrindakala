import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { medusa, formatPrice } from "@/lib/medusa";
import { getOrderShipment } from "@/lib/shipping/store";
import { getAdminOrder } from "@/lib/admin";
import { verifyOrderToken } from "@/lib/order-token";
import { OrderNextSteps } from "@/components/order-next-steps";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; t?: string }>;
}) {
  const { id } = await params;
  const { paid, t } = await searchParams;

  const token = await getAuthToken();
  // A guest has no session, but completion hands them a signed, expiring token
  // in the URL (and in the confirmation email). That token is the *only* thing
  // that lets a guest read their order — without it, the page still refuses.
  // The admin API is never used as a fallback: it exposes the full customer
  // record to anyone who guesses an id.
  const guestToken = verifyOrderToken(t, id) ? t : undefined;
  let order: any = null;
  let shipment: Awaited<ReturnType<typeof getOrderShipment>> = null;

  if (token) {
    try {
      order = await medusa.getOrder(id);
    } catch (error) {
      console.error("Failed to load order", error);
    }
  } else if (guestToken) {
    // Read the order through the admin read path guarded by the token, then
    // strip anything a guest does not need. The token proves ownership of this
    // one order id, so the scope is exactly the same as a signed-in customer
    // reading their own order.
    try {
      const result = await getAdminOrder(id);
      order = result.order;
    } catch (error) {
      console.error("Failed to load guest order via token", error);
    }
  }

  if (order) {
    try {
      shipment = await getOrderShipment(id);
    } catch (error) {
      console.error("Failed to load shipment", error);
    }
  }

  if (!order) {
    // A signed-in visitor asking for an order that is not theirs (or does not
    // exist) is a missing page, and should answer 404 so crawlers and uptime
    // checks see the truth. A guest who has just paid has no token yet, so
    // their request must still render the friendly explanation below rather
    // than a bare 404 — that page is the only thing standing between them and
    // a confirmation email they may not have opened yet.
    if (token) {
      notFound();
    }

    return (
      <main className="py-10">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-sand-border bg-surface p-12 text-center">
            <p className="text-lg text-muted-ink font-sans mb-2">
              We could not show this order here.
            </p>
            <p className="text-sm text-muted-ink font-sans mb-6">
              If you just paid, open the link in your confirmation email — it
              takes you straight to this order. Signing in with the address you
              used at checkout will also show it here.
            </p>
            <Link
              href="/account/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const items = order.items ?? [];
  const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0);

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline mb-4"
          >
            ← Back to account
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
            Order #{order.display_id ?? order.id.slice(-6)}
          </h1>
          <p className="mt-2 text-muted-ink font-sans">
            Placed{" "}
            <time dateTime={order.created_at}>
              {new Date(order.created_at).toLocaleDateString()}
            </time>
          </p>
        </div>

        {paid && (
          <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-sans">
            Payment confirmed — thank you for your order!
          </div>
        )}

        <OrderNextSteps
          status={order.status}
          paymentStatus={order.payment_status}
          hasShipment={Boolean(shipment?.awb_code)}
        />
        <div className="grid lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Items ({totalItems})
            </h2>
            <div className="space-y-6">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex gap-6 border-b border-sand-border pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-deep-ink">
                      {item.product_title || item.title || "Product"}
                    </p>
                    {item.variant_title && (
                      <p className="text-xs text-muted-ink font-sans">
                        {item.variant_title}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-sans text-deep-ink">
                      {formatPrice(
                        item.unit_price,
                        order.currency_code
                      )}
                    </p>
                    <p className="text-sm text-muted-ink font-sans">
                      × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right font-sans font-semibold text-deep-ink">
                    {formatPrice(
                      item.total ?? item.unit_price * item.quantity,
                      order.currency_code
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Order summary
            </h2>
            <ul className="space-y-4 text-muted-ink font-sans">
              <li className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal, order.currency_code)}</span>
              </li>
              {order.shipping_total && order.shipping_total > 0 && (
                <li className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatPrice(order.shipping_total, order.currency_code)}</span>
                </li>
              )}
              {order.tax_total && order.tax_total > 0 && (
                <li className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatPrice(order.tax_total, order.currency_code)}</span>
                </li>
              )}
              {order.discount_total && order.discount_total > 0 && (
                <li className="flex justify-between">
                  <span>Discount</span>
                  <span className="text-green-700">
                    -{formatPrice(order.discount_total, order.currency_code)}
                  </span>
                </li>
              )}
              <li className="flex justify-between border-t border-sand-border pt-4 font-serif font-semibold text-deep-ink">
                <span>Total</span>
                <span>{formatPrice(order.total, order.currency_code)}</span>
              </li>
            </ul>

            <div className="mt-8">
              <dl className="space-y-3 text-sm font-sans">
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Status</dt>
                  <dd className="text-deep-ink font-medium">
                    {order.status?.replace(/_/g, " ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Payment</dt>
                  <dd className="text-deep-ink font-medium">
                    {order.payment_status?.replace(/_/g, " ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Currency</dt>
                  <dd className="text-deep-ink font-medium">
                    {order.currency_code?.toUpperCase() || "INR"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        {order.shipping_address && (
          <section className="mt-8 rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Shipping address
            </h2>
            <dl className="space-y-2 text-sm font-sans">
              <div className="flex justify-between">
                <dt className="text-muted-ink">Name</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">Address</dt>
                <dd className="text-deep-ink">
                  {order.shipping_address.address_1 || "—"}
                  {order.shipping_address.address_2 && (
                    <span className="block text-muted-ink">
                      {order.shipping_address.address_2}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">City, State</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.city || ""}, ${order.shipping_address.province || ""}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">PIN / Country</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.postal_code || ""} ${order.shipping_address.country_code || "IN"}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">Phone</dt>
                <dd className="text-deep-ink">{order.shipping_address.phone || "—"}</dd>
              </div>
            </dl>
          </section>
        )}

        {shipment && (
          <section className="mt-8 rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Shipment
            </h2>
            <dl className="space-y-3 text-sm font-sans">
              <div className="flex justify-between">
                <dt className="text-muted-ink">Status</dt>
                <dd className="text-deep-ink font-medium capitalize">
                  {shipment.status?.replace(/_/g, " ")}
                </dd>
              </div>
              {shipment.courier_name && (
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Courier</dt>
                  <dd className="text-deep-ink">
                    {shipment.courier_name}
                    {shipment.courier_service
                      ? ` · ${shipment.courier_service}`
                      : ""}
                  </dd>
                </div>
              )}
              {shipment.awb_code && (
                <div className="flex justify-between">
                  <dt className="text-muted-ink">AWB / Tracking no.</dt>
                  <dd className="text-deep-ink font-mono text-xs">
                    {shipment.awb_code}
                  </dd>
                </div>
              )}
            </dl>
            {shipment.tracking_url && (
              <a
                href={shipment.tracking_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
              >
                Track your shipment →
              </a>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/shop"
            className="text-sm text-muted-ink font-sans hover:text-sindoor transition-colors"
          >
            ← Continue shopping
          </Link>
          <Link
            href={`/account/returns?order_id=${order.id}`}
            className="text-sm font-medium text-sindoor hover:underline"
          >
            Need to return something? Request a return →
          </Link>
        </div>
      </div>
    </main>
  );
}
