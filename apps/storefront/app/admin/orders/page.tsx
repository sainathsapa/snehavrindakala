"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { hasPermission } from "@/lib/rbac";
import { BulkActionsToolbar } from "@/components/bulk-actions-toolbar";
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
  created_at: string;
  updated_at: string;
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const page = searchParams.get("page") || "1";
  const [orders, setOrders] = useState<Order[]>([]);
  const [count, setCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const userRole = "super_admin";

  if (!hasPermission(userRole as any, "orders:read")) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-sand-border bg-surface p-12 text-center">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-2">
              Unauthorized
            </h2>
            <p className="text-muted-ink font-sans">
              You do not have permission to view orders.
            </p>
          </div>
        </div>
      </main>
    );
  }

  useEffect(() => {
    loadOrders();
  }, [q, status, page]);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/orders?limit=20&offset=${(
          (parseInt(page || "1") - 1) * 20
        ) || 0}${status ? `&status=${status}` : ""}${
          q ? `&q=${q}` : ""
        }`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setCount(data.count || 0);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(
      checked ? orders.map((o) => o.id) : []
    );
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading orders...</p>
        </div>
      </main>
    );
  }

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
          {hasPermission(userRole as any, "orders:write") && (
            <Link
              href="/admin/orders/new"
              className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              New Order
            </Link>
          )}
        </div>

        {hasPermission(userRole as any, "orders:write") && (
          <BulkActionsToolbar
            selectedIds={selectedIds}
            type="orders"
            onSelectionChange={setSelectedIds}
            canWrite={true}
          />
        )}

        <div className="flex gap-4 mb-6">
          <select
            defaultValue={status || ""}
            onChange={(e) => {
              const params = new URLSearchParams(window.location.search);
              if (e.target.value) params.set("status", e.target.value);
              else params.delete("status");
              window.location.search = params.toString();
            }}
            className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          <input
            type="text"
            placeholder="Search orders…"
            className="flex-1 px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            defaultValue={q || ""}
            onChange={(e) => {
              const params = new URLSearchParams(window.location.search);
              if (e.target.value) params.set("q", e.target.value);
              else params.delete("q");
              window.location.search = params.toString();
            }}
          />
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                {hasPermission(userRole as any, "orders:write") && (
                  <th className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === orders.length &&
                        orders.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded text-sindoor focus:ring-sindoor"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Total
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {orders.length > 0 ? (
                orders.map((order: Order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-rang-paper/50 transition-colors"
                  >
                    {hasPermission(userRole as any, "orders:write") && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected(order.id)}
                          onChange={(e) =>
                            handleSelect(order.id, e.target.checked)
                          }
                          className="rounded text-sindoor focus:ring-sindoor"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      #{order.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-sans text-sm text-deep-ink">
                        {order.customer?.first_name} {order.customer?.last_name}
                      </div>
                      <div className="text-xs text-muted-ink">
                        {order.customer?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                          order.status === "completed"
                            ? "bg-leaf/10 text-leaf border border-leaf/20"
                            : order.status === "cancelled"
                              ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                              : order.status === "pending"
                                ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                                : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-sans text-sm ${
                          order.payment_status === "paid"
                            ? "text-leaf"
                            : order.payment_status === "refunded"
                              ? "text-sindoor"
                              : "text-muted-ink"
                        } font-medium`}
                      >
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      {(order.total / 100).toFixed(2)}
                      {order.currency_code?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orders/[id]?id=${order.id}`}
                        className="text-sm font-medium text-sindoor hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No orders found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {count > 20 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {orders.length} of {count} orders
            </p>
            <div className="flex gap-2">
              {Array.from({ length: Math.ceil(count / 20) }).map((_, i) => (
                <Link
                  key={i}
                  href={`/admin/orders?page=${i + 1}${
                    status ? `&status=${status}` : ""
                  }${q ? `&q=${q}` : ""}`}
                  className={`px-3 py-1 rounded-md text-sm font-sans ${
                    parseInt(page || "1") === i + 1
                      ? "bg-sindoor text-rang-paper"
                      : "text-muted-ink hover:bg-rang-paper/50"
                  }`}
                >
                  {i + 1}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
