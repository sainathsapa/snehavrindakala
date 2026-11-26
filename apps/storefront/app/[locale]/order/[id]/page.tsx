import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { medusa, formatPrice } from "@/lib/medusa";
import { getOrderShipment } from "@/lib/shipping/store";
import { shipmentStatusClasses, shipmentStatusLabel } from "@/lib/shipping/status-label";
import { trackingLink } from "@/lib/shipping/notify";
import { getAdminOrder } from "@/lib/admin";
import { verifyOrderToken } from "@/lib/order-token";
import { OrderNextSteps } from "@/components/order-next-steps";
import { RedirectToOrders } from "@/components/redirect-to-orders";
import { listCertificatesForOrder } from "@/lib/certificates";
import { getGiftForOrder } from "@/lib/gift";
import { getTranslations } from "next-intl/server";

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
  const t18n = await getTranslations("order");

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
              {t18n("noAccessTitle")}
            </p>
            <p className="text-sm text-muted-ink font-sans mb-6">
              {t18n("noAccessBody")}
            </p>
            <Link
              href="/account/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
            >
              {t18n("signIn")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const items = order.items ?? [];
  const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0);

  // One certificate per work, issued at checkout. Absent for orders placed
  // before certificates existed, and for a guest opening a stale link — an
  // empty list simply renders nothing rather than an apology.
  let certificates: Awaited<ReturnType<typeof listCertificatesForOrder>> = [];
  try {
    certificates = await listCertificatesForOrder(order.id);
  } catch (error) {
    console.error("Could not load certificates for the order", error);
  }

  // The gift note is shown back to the buyer so they can see it was recorded,
  // and because a note written weeks ago is worth being able to re-read.
  let gift: Awaited<ReturnType<typeof getGiftForOrder>> = null;
  try {
    gift = await getGiftForOrder(order.id);
  } catch (error) {
    console.error("Could not load the gift note for the order", error);
  }

  // NOTE on the hand-off: Medusa only assigns `customer_id` when an order has no
  // email and a customer is later created from it (see updateOrderWorkflow). A
  // guest order therefore keeps `customer_id: null`, so this order will not
  // appear in the new account's order list even though the account exists. The
  // copy below says the account is ready rather than claiming the order is in
  // it, because the second part would be untrue. Linking retroactively means
  // either a raw write into Medusa's order table (which is what upgrades break)
  // or a supported workflow that does not exist yet — a decision for the owner,
  // not something to fake in a banner.
  const invoiceHref =
    `/api/orders/${order.id}/invoice` +
    (guestToken ? `?t=${encodeURIComponent(guestToken)}` : "");

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline mb-4"
          >
            ← {t18n("backToAccount")}
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
            {t18n("title", { ref: String(order.display_id ?? order.id.slice(-6)) })}
          </h1>
          <p className="mt-2 text-muted-ink font-sans">
            {t18n("placed")}{" "}
            <time dateTime={order.created_at}>
              {new Date(order.created_at).toLocaleDateString()}
            </time>
          </p>
        </div>

        {paid && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-sans">
            {t18n("paidBanner")}
          </div>
        )}

        {/* Thank-you step: the invoice is downloadable here, and the page moves
            on to the account's order list on its own. Both are links, so this
            still works without JavaScript. */}
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-sand-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-sans text-sm text-muted-ink">
            <p className="font-medium text-deep-ink">Your invoice</p>
            <p className="mt-1">
              A PDF copy was emailed with your confirmation. You can open it here
              too.
            </p>
          </div>
          <a
            href={invoiceHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sindoor px-4 py-2 font-sans text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
          >
            Download invoice (PDF)
          </a>
        </div>

        {paid && (
          <RedirectToOrders
            href="/account"
            seconds={8}
            message="Taking you to your account in {seconds}s — it is ready, and the password is in your inbox."
            stayLabel="Stay here"
            goLabel="Go now"
          />
        )}

        <OrderNextSteps
          status={order.status}
          paymentStatus={order.payment_status}
          hasShipment={Boolean(shipment?.awb_code)}
        />
        <div className="grid lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              {t18n("itemsHeading", { count: totalItems })}
            </h2>
            <div className="space-y-6">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex gap-6 border-b border-sand-border pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-deep-ink">
                      {item.product_title || item.title || t18n("productFallback")}
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

            {gift && (gift.note || gift.wrap) && (
              <div className="mt-8 border-t border-sand-border pt-6">
                <h3 className="font-serif text-lg font-semibold text-deep-ink">
                  {t18n("giftHeading")}
                </h3>
                {gift.wrap && (
                  <p className="mt-1 font-sans text-sm text-muted-ink">
                    {t18n("giftWrapped")}
                  </p>
                )}
                {gift.note && (
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-sand-border pl-3 font-sans text-sm italic text-deep-ink">
                    {gift.note}
                  </p>
                )}
              </div>
            )}

            {certificates.length > 0 && (
              <div className="mt-8 border-t border-sand-border pt-6">
                <h3 className="font-serif text-lg font-semibold text-deep-ink">
                  {t18n("certHeading")}
                </h3>
                <p className="mt-1 mb-4 font-sans text-sm text-muted-ink">
                  {t18n("certIntro")}
                </p>
                <ul className="space-y-3">
                  {certificates.map((certificate) => (
                    <li
                      key={certificate.code}
                      className="flex flex-wrap items-baseline justify-between gap-2"
                    >
                      <span className="font-serif text-deep-ink">
                        {certificate.title || t18n("certUntitled")}
                      </span>
                      <Link
                        href={`/verify/${certificate.code}`}
                        className="font-sans text-sm text-sindoor hover:underline"
                      >
                        {t18n("certView")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              {t18n("summaryHeading")}
            </h2>
            <ul className="space-y-4 text-muted-ink font-sans">
              <li className="flex justify-between">
                <span>{t18n("subtotal")}</span>
                <span>{formatPrice(order.subtotal, order.currency_code)}</span>
              </li>
              {order.shipping_total && order.shipping_total > 0 && (
                <li className="flex justify-between">
                  <span>{t18n("shipping")}</span>
                  <span>{formatPrice(order.shipping_total, order.currency_code)}</span>
                </li>
              )}
              {order.tax_total && order.tax_total > 0 && (
                <li className="flex justify-between">
                  <span>{t18n("tax")}</span>
                  <span>{formatPrice(order.tax_total, order.currency_code)}</span>
                </li>
              )}
              {order.discount_total && order.discount_total > 0 && (
                <li className="flex justify-between">
                  <span>{t18n("discount")}</span>
                  <span className="text-green-700">
                    -{formatPrice(order.discount_total, order.currency_code)}
                  </span>
                </li>
              )}
              <li className="flex justify-between border-t border-sand-border pt-4 font-serif font-semibold text-deep-ink">
                <span>{t18n("total")}</span>
                <span>{formatPrice(order.total, order.currency_code)}</span>
              </li>
            </ul>

            <div className="mt-8">
              <dl className="space-y-3 text-sm font-sans">
                <div className="flex justify-between">
                  <dt className="text-muted-ink">{t18n("statusLabel")}</dt>
                  <dd className="text-deep-ink font-medium">
                    {order.status?.replace(/_/g, " ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">{t18n("paymentLabel")}</dt>
                  <dd className="text-deep-ink font-medium">
                    {order.payment_status?.replace(/_/g, " ") || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">{t18n("currencyLabel")}</dt>
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
              {t18n("addressHeading")}
            </h2>
            <dl className="space-y-2 text-sm font-sans">
              <div className="flex justify-between">
                <dt className="text-muted-ink">{t18n("nameLabel")}</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">{t18n("addressLabel")}</dt>
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
                <dt className="text-muted-ink">{t18n("cityState")}</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.city || ""}, ${order.shipping_address.province || ""}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">{t18n("pinCountry")}</dt>
                <dd className="text-deep-ink">
                  {`${order.shipping_address.postal_code || ""} ${order.shipping_address.country_code || "IN"}`.trim() || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-ink">{t18n("phoneLabel")}</dt>
                <dd className="text-deep-ink">{order.shipping_address.phone || "—"}</dd>
              </div>
            </dl>
          </section>
        )}

        {shipment && (
          <section className="mt-8 rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              {t18n("shipmentHeading")}
            </h2>
            <dl className="space-y-3 text-sm font-sans">
              <div className="flex justify-between">
                <dt className="text-muted-ink">Status</dt>
                <dd>
                  {(() => {
                    const status = shipmentStatusLabel(shipment.status);
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider text-[10px] ${shipmentStatusClasses(
                          status.tone
                        )}`}
                      >
                        {status.label}
                      </span>
                    );
                  })()}
                </dd>
              </div>
              {shipment.courier_name && (
                <div className="flex justify-between">
                  <dt className="text-muted-ink">{t18n("courierLabel")}</dt>
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
                  <dt className="text-muted-ink">{t18n("awbLabel")}</dt>
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
                {t18n("trackShipment")}
              </a>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/shop"
            className="text-sm text-muted-ink font-sans hover:text-sindoor transition-colors"
          >
            ← {t18n("continueShopping")}
          </Link>
          <Link
            href={`/account/returns?order_id=${order.id}`}
            className="text-sm font-medium text-sindoor hover:underline"
          >
            {t18n("requestReturn")}
          </Link>
        </div>
      </div>
    </main>
  );
}
