"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@snehavrinda-kala/ui";

interface OrderLineItem {
  id: string;
  title: string;
  variant_title?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Shipment {
  id: string;
  order_id: string;
  shipment_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  courier_service: string | null;
  tracking_url: string | null;
  label_url: string | null;
  pickup_location: string | null;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  display_id?: number | string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: number;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  currencyCode: string;
  created_at: string;
  customer?: any;
  shipping_address?: any;
  billing_address?: any;
  payment_collections?: any[];
  fulfillments?: any[];
  items: OrderLineItem[];
  /** Written by the buyer at checkout; read on the packing bench. */
  gift?: { note: string; wrap: boolean } | null;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (id) {
      fetch(`/api/admin/orders/${id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: any) => {
          setOrder({
            id: data.id || "",
            display_id: data.display_id,
            customerName: `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim(),
            customerEmail: data.customer?.email || "",
            status: data.status || "",
            paymentStatus: data.payment_status || "",
            fulfillmentStatus: data.fulfillment_status || "",
            total: data.total || 0,
            subtotal: data.subtotal || 0,
            taxTotal: data.tax_total || 0,
            shippingTotal: data.shipping_total || 0,
            discountTotal: data.discount_total || 0,
            currencyCode: data.currency_code || "inr",
            created_at: data.created_at || "",
            customer: data.customer,
            shipping_address: data.shipping_address,
            billing_address: data.billing_address,
            payment_collections: data.payment_collections || [],
            fulfillments: data.fulfillments || [],
            gift: data.gift ?? null,
            items: (data.items || []).map((item: any) => ({
              id: item.id || "",
              title: item.product_title || item.title || "Product",
              variant_title: item.variant_title || null,
              sku: item.sku || null,
              quantity: item.quantity || 0,
              unit_price: item.unit_price || 0,
              total: item.total || item.unit_price * item.quantity,
            })),
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));

      fetch(`/api/admin/orders/${id}/shipment`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: any) => setShipment(data.shipment || null))
        .catch(() => {});
    }
  }, [id]);

  async function handleCreateShipment() {
    if (!order) return;
    setCreatingShipment(true);
    setShipmentError("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipment`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create shipment");
      setShipment(data.shipment || null);
    } catch (err: any) {
      setShipmentError(err.message || "Failed to create shipment");
    } finally {
      setCreatingShipment(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading order...</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Order not found.</p>
        </div>
      </main>
    );
  }

  async function handleCancel() {
    if (!order) return;
    if (
      !window.confirm(
        `Cancel order #${order.display_id ?? order.id.slice(-8)}? This cannot be undone.`
      )
    )
      return;
    setCancelling(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/orders/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order");
      setOrder((prev) =>
        prev ? { ...prev, status: "cancelled" } : null
      );
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const canCancel =
    order.paymentStatus !== "refunded" &&
    (order.status === "pending" || order.status === "processing");

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
            >
              ← Back to Orders
            </Link>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Order #{order.display_id ?? order.id.slice(-6)}
            </h1>
          </div>
          <div className="flex gap-3">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getStatusClass(order.status)}`}
            >
              {order.status}
            </span>
            <Link
              href={`/admin/orders/${id}/refunds`}
              className="text-sm font-sans text-sindoor hover:underline"
            >
              Refunds
            </Link>
            <Link
              href={`/admin/orders/${id}/invoice`}
              className="text-sm font-sans text-sindoor hover:underline"
            >
              Print Invoice
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-6">
              Line Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left divide-y divide-sand-border">
                <thead>
                  <tr className="bg-surface">
                    <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                      Unit Price
                    </th>
                    <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-center">
                      Qty
                    </th>
                    <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {order.items.length > 0 ? (
                    <>
                      {order.items.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-rang-paper/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                            {item.title}
                            {item.variant_title && (
                              <span className="block text-xs text-muted-ink">
                                {item.variant_title}
                              </span>
                            )}
                            {item.sku && (
                              <span className="block text-xs text-muted-ink">
                                SKU: {item.sku}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                            {(item.unit_price / 100).toFixed(2)}
                            {order.currencyCode?.toUpperCase()}
                          </td>
                          <td className="px-6 py-4 font-sans text-sm text-deep-ink text-center">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                            {(item.total / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <p className="text-muted-ink font-sans">
                          No items found.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-rang-paper/30">
                    <td className="px-6 py-4 font-sans font-semibold text-deep-ink text-right">
                      Order Total
                    </td>
                    <td colSpan={3} className="px-6 py-4 font-sans font-serif font-bold text-deep-ink text-right">
                      {(order.total / 100).toFixed(2)}
                      {" "}
                      {order.currencyCode?.toUpperCase()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl border border-sand-border bg-surface p-6">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                Order Summary
              </h3>
              <div className="space-y-3 text-sm font-sans">
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Subtotal</dt>
                  <dd className="text-deep-ink text-right">
                    {(order.subtotal / 100).toFixed(2)}
                    {" "}
                    {order.currencyCode?.toUpperCase()}
                  </dd>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">Discount</dt>
                    <dd className="text-red-600 text-right">
                      -{(order.discountTotal / 100).toFixed(2)}
                      {" "}
                      {order.currencyCode?.toUpperCase()}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Shipping</dt>
                  <dd className="text-deep-ink text-right">
                    {(order.shippingTotal / 100).toFixed(2)}
                    {" "}
                    {order.currencyCode?.toUpperCase()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Tax</dt>
                  <dd className="text-deep-ink text-right">
                    {(order.taxTotal / 100).toFixed(2)}
                    {" "}
                    {order.currencyCode?.toUpperCase()}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-sand-border pt-2 font-serif font-semibold text-deep-ink">
                  <dt>Total</dt>
                  <dd className="text-right">
                    {(order.total / 100).toFixed(2)}
                    {" "}
                    {order.currencyCode?.toUpperCase()}
                  </dd>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sand-border bg-surface p-6">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                Payment
              </h3>
              <div className="space-y-3 text-sm font-sans">
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Status</dt>
                  <dd className="text-deep-ink text-right">
                    {order.paymentStatus?.replace(/_/g, " ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Fulfillment</dt>
                  <dd className="text-deep-ink text-right">
                    {order.fulfillmentStatus
                      ? order.fulfillmentStatus.replace(/_/g, " ")
                      : "—"}
                  </dd>
                </div>
              </div>

              {order.payment_collections &&
                order.payment_collections.length > 0 && (
                  <div className="mt-4 border-t border-sand-border pt-4">
                    <h4 className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">
                      Payment Collections
                    </h4>
                    <ul className="space-y-2 text-xs font-sans text-muted-ink">
                      {order.payment_collections.map((pc: any) => (
                        <li
                          key={pc.id}
                          className="flex justify-between"
                        >
                          <span>
                            {pc.amount ? (pc.amount / 100).toFixed(2) : "—"}
                          </span>
                          <span>{pc.status || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {(order.gift?.note || order.gift?.wrap) && (
              <div className="rounded-xl border border-sand-border bg-surface p-6">
                <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-3">
                  Gift
                </h3>
                {order.gift?.wrap && (
                  <p className="font-sans text-sm text-deep-ink">Wrap this work.</p>
                )}
                {order.gift?.note && (
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-sand-border pl-3 font-sans text-sm italic text-deep-ink">
                    {order.gift.note}
                  </p>
                )}
                <p className="mt-3 font-sans text-xs text-muted-ink">
                  Written by the buyer at checkout. Copy it onto the card exactly as
                  it appears — do not edit someone&rsquo;s words.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-sand-border bg-surface p-6">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                Shipping
              </h3>

              {shipment ? (
                <div className="space-y-3 text-sm font-sans">
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">Status</dt>
                    <dd className="text-deep-ink text-right capitalize">
                      {shipment.status?.replace(/_/g, " ")}
                    </dd>
                  </div>
                  {shipment.courier_name && (
                    <div className="flex justify-between">
                      <dt className="text-muted-ink">Courier</dt>
                      <dd className="text-deep-ink text-right">
                        {shipment.courier_name}
                        {shipment.courier_service
                          ? ` · ${shipment.courier_service}`
                          : ""}
                      </dd>
                    </div>
                  )}
                  {shipment.awb_code && (
                    <div className="flex justify-between">
                      <dt className="text-muted-ink">AWB</dt>
                      <dd className="text-deep-ink text-right font-mono text-xs">
                        {shipment.awb_code}
                      </dd>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    {shipment.tracking_url && (
                      <a
                        href={shipment.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sindoor hover:underline"
                      >
                        Track shipment →
                      </a>
                    )}
                    {shipment.label_url && (
                      <a
                        href={shipment.label_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sindoor hover:underline"
                      >
                        Shipping label →
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-ink font-sans">
                    No shipment has been created for this order yet.
                  </p>
                  <button
                    onClick={handleCreateShipment}
                    disabled={creatingShipment}
                    className="w-full rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 disabled:opacity-50 transition-colors"
                  >
                    {creatingShipment ? "Creating shipment…" : "Create shipment"}
                  </button>
                  {shipmentError && (
                    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-sans">
                      {shipmentError}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-sand-border pt-4">
                <Link
                  href={`/admin/returns?order_id=${order.id}`}
                  className="text-sm font-sans text-sindoor hover:underline"
                >
                  View return requests →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {order.shipping_address && (
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="rounded-xl border border-sand-border bg-surface p-6">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                Shipping Address
              </h3>
              <dl className="space-y-2 text-sm font-sans">
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Name</dt>
                  <dd className="text-deep-ink">
                    {`${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim() ||
                      "—"}
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
                    {`${order.shipping_address.city || ""}, ${order.shipping_address.province || ""}`.trim() ||
                      "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">PIN / Country</dt>
                  <dd className="text-deep-ink">
                    {`${order.shipping_address.postal_code || ""} ${order.shipping_address.country_code || "IN"}`.trim() ||
                      "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-ink">Phone</dt>
                  <dd className="text-deep-ink">
                    {order.shipping_address.phone || "—"}
                  </dd>
                </div>
              </dl>
            </div>
            {order.billing_address && (
              <div className="rounded-xl border border-sand-border bg-surface p-6">
                <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                  Billing Address
                </h3>
                <dl className="space-y-2 text-sm font-sans">
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">Name</dt>
                    <dd className="text-deep-ink">
                      {`${order.billing_address.first_name || ""} ${order.billing_address.last_name || ""}`.trim() ||
                        "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">Address</dt>
                    <dd className="text-deep-ink">
                      {order.billing_address.address_1 || "—"}
                      {order.billing_address.address_2 && (
                        <span className="block text-muted-ink">
                          {order.billing_address.address_2}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">City, State</dt>
                    <dd className="text-deep-ink">
                      {`${order.billing_address.city || ""}, ${order.billing_address.province || ""}`.trim() ||
                        "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">PIN / Country</dt>
                    <dd className="text-deep-ink">
                      {`${order.billing_address.postal_code || ""} ${order.billing_address.country_code || "IN"}`.trim() ||
                        "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-ink">Phone</dt>
                    <dd className="text-deep-ink">
                      {order.billing_address.phone || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}

        {order.fulfillments &&
          order.fulfillments.length > 0 && (
            <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
              <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
                Fulfillments
              </h3>
              <ul className="space-y-3 text-sm font-sans">
                {order.fulfillments.map((f: any) => (
                  <li
                    key={f.id}
                    className="flex justify-between border-b border-sand-border pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-deep-ink">
                      {f.provider || "Provider"}
                    </span>
                    <span className="text-muted-ink">{f.status || "—"}</span>
                    {f.tracking_url && (
                      <span className="text-sindoor text-xs font-medium">
                        Track
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

        <div className="rounded-xl border border-sand-border bg-surface p-6">
          <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider mb-4">
            Actions
          </h3>
          <div className="flex items-center gap-3">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-red-600 font-medium hover:underline disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel order"}
              </button>
            )}
            {order.status === "cancelled" && (
              <span className="text-xs text-muted-ink">Cancelled</span>
            )}
            {actionError && (
              <p className="mt-2 text-xs text-red-600">{actionError}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function getStatusClass(s: string): string {
  switch (s) {
    case "pending":
      return "bg-terracotta/10 text-terracotta border border-terracotta/20";
    case "processing":
      return "bg-sindoor/10 text-sindoor border border-sindoor/20";
    case "completed":
      return "bg-leaf/10 text-leaf border border-leaf/20";
    case "cancelled":
      return "bg-sindoor/10 text-sindoor border border-sindoor/20";
    default:
      return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
  }
}
