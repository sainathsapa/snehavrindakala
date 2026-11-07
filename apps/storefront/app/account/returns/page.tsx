"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Return {
  id: string;
  order_id: string;
  customer_email: string;
  reason: string;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  display_id?: number | string;
  status: string;
  created_at: string;
}

const statusClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-800",
};

export default function AccountReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOrderId, setFormOrderId] = useState("");
  const [formReason, setFormReason] = useState("");

  const loadReturns = async () => {
    try {
      const res = await fetch("/api/account/returns", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
      }
    } catch (err) {
      console.error("Failed to load returns", err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/account/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    }
  };

  useEffect(() => {
    // Preselect the order when arriving from an order confirmation link.
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (orderId) setFormOrderId(orderId);
    loadReturns();
    loadOrders();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/account/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: formOrderId,
          reason: formReason,
          items: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create return");
      setSuccess("Return request submitted successfully.");
      setFormOrderId("");
      setFormReason("");
      loadReturns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading returns...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Account
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Returns &amp; Refunds
          </h1>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-sans">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-sans">
            {success}
          </div>
        )}

        {/* Request a return */}
        <div className="rounded-xl border border-sand-border bg-surface p-8 mb-10">
          <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
            Request a Return
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <div>
              <label
                htmlFor="order_id"
                className="block text-sm font-medium text-deep-ink mb-1"
              >
                Order ID
              </label>
              <select
                id="order_id"
                name="order_id"
                value={formOrderId}
                onChange={(e) => setFormOrderId(e.target.value)}
                required
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                <option value="">Select an order…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.display_id || o.id.slice(-8)} -
                    {o.status} • {new Date(o.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-deep-ink mb-1"
              >
                Reason for return
              </label>
              <textarea
                id="reason"
                name="reason"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                rows={3}
                required
                placeholder="e.g. Damaged item, wrong size, not as described"
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Request Return"}
            </button>
          </form>
        </div>

        {/* Existing returns */}
        <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
          Your Return Requests
        </h2>
        {returns.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-12 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              No return requests yet.
            </p>
            <p className="text-sm text-muted-ink font-sans">
              Return requests will appear here once you submit one.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
            <table className="w-full text-left divide-y divide-sand-border">
              <thead>
                <tr className="bg-surface">
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Return ID
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-border">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-rang-paper/50 transition-colors">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      #{r.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      #{r.order_id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {r.reason}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          statusClasses[r.status] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
