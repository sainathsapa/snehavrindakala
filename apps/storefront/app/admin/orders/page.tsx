"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  total: number;
  currencyCode: string;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/orders?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const rows: Order[] = (data.orders || []).map((o: any) => ({
          id: o.id || "",
          customerName: `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim(),
          customerEmail: o.customer?.email || "",
          status: o.status || "",
          paymentStatus: o.payment_status || "",
          total: o.total || 0,
          currencyCode: o.currency_code || "inr",
          createdAt: o.created_at || "",
        }));
        setOrders(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading orders...</p>
        </div>
      </main>
    );
  }

  const orderRows =
    orders.length > 0
      ? orders.map((order: Order) => (
          <tr key={order.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{order.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {order.customerName}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {order.customerEmail}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {(order.total / 100).toFixed(2)}
              {order.currencyCode?.toUpperCase()}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(order.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={5} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No orders found.
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Orders
            </h1>
            <p className="text-muted-ink font-sans">
              Manage customer orders and fulfillment.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Total
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {orderRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}