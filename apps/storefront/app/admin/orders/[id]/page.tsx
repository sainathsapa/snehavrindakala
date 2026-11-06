"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";
import { useSearchParams } from "next/navigation";

interface Order {
  id: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total: number;
  currency_code: string;
  customer?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  shipping_address?: any;
  items?: any[];
  created_at: string;
  updated_at: string;
}

export default function OrderDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fulfillmentForm, setFulfillmentForm] = useState({
    carrier: "",
    tracking_number: "",
    notes: "",
  });

  useEffect(() => {
    if (id) {
      loadOrder(id);
    }
  }, [id]);

  async function loadOrder(orderId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        if (data.order?.shipping_address) {
          setFulfillmentForm((prev) => ({
            ...prev,
            carrier: data.order.shipping_address.carrier || "",
            tracking_number: data.order.shipping_address.tracking_number || "",
          }));
        }
      } else {
        setMessage({ ok: false, text: "Order not found." });
      }
    } catch (err) {
      setMessage({ ok: false, text: "Failed to load order." });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Order status updated." });
        loadOrder(id);
      } else {
        setMessage({ ok: false, text: "Failed to update status." });
      }
    } catch {
      setMessage({ ok: false, text: "Error updating status." });
    } finally {
      setSaving(false);
    }
  }

  async function handleFulfillmentUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment_status: fulfillmentForm.carrier ? "shipped" : "pending",
          shipping_address: {
            carrier: fulfillmentForm.carrier,
            tracking_number: fulfillmentForm.tracking_number,
            notes: fulfillmentForm.notes,
          },
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Fulfillment updated." });
        loadOrder(id);
      } else {
        setMessage({ ok: false, text: "Failed to update fulfillment." });
      }
    } catch {
      setMessage({ ok: false, text: "Error updating fulfillment." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading order...</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Order not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Orders
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Order #{order.id.slice(-8)}
          </h1>
          <p className="text-muted-ink font-sans">
            Order placed on {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>

        {message && (
          <p className={`mb-6 rounded-md p-3 text-sm font-sans ${
            message.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}
          </p>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Order Total</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">
              {order.currency_code?.toUpperCase()} {(order.total / 100).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Payment Status</p>
            <span
              className={`font-serif font-bold text-deep-ink ${
                order.payment_status === "paid"
                  ? "text-leaf"
                  : order.payment_status === "refunded"
                    ? "text-sindoor"
                    : "text-muted-ink"
              }`}
            >
              {order.payment_status}
            </span>
          </div>
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Fulfillment</p>
            <span
              className={`font-serif font-bold text-deep-ink ${
                order.fulfillment_status === "shipped"
                  ? "text-leaf"
                  : order.fulfillment_status === "pending"
                    ? "text-terracotta"
                    : "text-muted-ink"
              }`}
            >
              {order.fulfillment_status}
            </span>
          </div>
        </div>

        {/* Customer info */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
            Customer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Name</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.first_name} {order.customer?.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Email</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Customer ID</p>
              <p className="text-sm font-sans text-deep-ink">
                {order.customer?.id}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">View Profile</p>
              <Link
                href={`/admin/customers/${order.customer?.id}`}
                className="text-sindoor font-medium hover:underline"
              >
                View customer details →
              </Link>
            </div>
          </div>
        </div>

        {/* Status update */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Update Order Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["pending", "processing", "completed", "cancelled", "refunded"].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={saving}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                  order.status === status
                    ? "bg-sindoor text-rang-paper border border-sindoor"
                    : "bg-surface border border-sand-border text-deep-ink hover:bg-rang-paper/50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Fulfillment tracking */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Shipping & Fulfillment</h2>
          <form onSubmit={handleFulfillmentUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink mb-2">Shipping Carrier</label>
                <input
                  name="carrier"
                  type="text"
                  value={fulfillmentForm.carrier}
                  onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, carrier: e.target.value })}
                  placeholder="e.g. Shiprocket, Delhivery, Blue Dart"
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink mb-2">Tracking Number</label>
                <input
                  name="tracking_number"
                  type="text"
                  value={fulfillmentForm.tracking_number}
                  onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, tracking_number: e.target.value })}
                  placeholder="e.g. SR123456789"
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink mb-2">Notes</label>
                <input
                  name="notes"
                  type="text"
                  value={fulfillmentForm.notes}
                  onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, notes: e.target.value })}
                  placeholder="Delivery notes..."
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-auto px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update Fulfillment"}
            </button>
          </form>
        </div>

        {/* Order items */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="border-b border-sand-border bg-rang-paper p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-surface">
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Unit Price</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {(order.items || []).map((item: any) => (
                  <tr key={item.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {item.title || item.product_title}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {(item.unit_price / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {((item.unit_price || 0) * item.quantity / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
