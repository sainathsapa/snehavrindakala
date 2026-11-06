"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  total: number;
  currencyCode: string;
  created_at: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/admin/orders/${id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: any) => {
          setOrder({
            id: data.id || "",
            customerName: `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim(),
            customerEmail: data.customer?.email || "",
            status: data.status || "",
            paymentStatus: data.payment_status || "",
            total: data.total || 0,
            currencyCode: data.currency_code || "inr",
            created_at: data.created_at || "",
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

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

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4">
              ← Back to Orders
            </Link>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Order #{order.id.slice(-6)}
            </h1>
          </div>
          <div className="flex gap-2">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getStatusClass(order.status)}`}
            >
              {order.status}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Field
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Order ID
                </td>
                <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                  #{order.id.slice(-8)}
                </td>
              </tr>
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Customer
                </td>
                <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                  {order.customerName} ({order.customerEmail})
                </td>
              </tr>
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Status
                </td>
                <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                  {order.status}
                </td>
              </tr>
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Payment Status
                </td>
                <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                  {order.paymentStatus}
                </td>
              </tr>
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Total
                </td>
                <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                  {(order.total / 100).toFixed(2)} {order.currencyCode?.toUpperCase()}
                </td>
              </tr>
              <tr className="hover:bg-rang-paper/50 transition-colors">
                <td className="px-6 py-4 font-sans text-sm text-muted-ink uppercase tracking-wider">
                  Created
                </td>
                <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            </tbody>
          </table>
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