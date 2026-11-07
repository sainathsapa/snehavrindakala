"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";

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

const STATUS_OPTIONS = ["pending", "processing", "completed", "cancelled", "refunded"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [actionError, setActionError] = useState("");
  const LIMIT = 20;

  const loadOrders = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store" })
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
        setTotalCount(data.count ?? rows.length);
        setSelectedIds(new Set());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const isSelected = (id: string) => selectedIds.has(id);

  const executeBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    if (bulkAction === "cancel") {
      if (
        !window.confirm(
          `Cancel ${selectedIds.size} selected order(s)? This cannot be undone.`
        )
      )
        return;
    }
    try {
      await Promise.all(
        Array.from(selectedIds).map((orderId) =>
          fetch(`/api/admin/orders/${orderId}/cancel`, { method: "POST" })
        )
      );
      setSelectedIds(new Set());
      setBulkAction("");
      loadOrders();
    } catch (err: any) {
      setActionError(err.message || "Bulk action failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const paginatedOrders = orders.slice(0, LIMIT);

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
    paginatedOrders.length > 0
      ? paginatedOrders.map((order: Order) => (
          <tr key={order.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 text-center">
              <input
                type="checkbox"
                checked={isSelected(order.id)}
                onChange={() => toggleSelect(order.id)}
                className="rounded border-sand-border text-sindoor focus:ring-sindoor"
              />
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              <Link
                href={`/admin/orders/${order.id}`}
                className="text-sindoor font-medium hover:underline"
              >
                #{order.id.slice(-8)}
              </Link>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {order.customerName || "—"}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {order.customerEmail}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  order.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : order.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : order.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {order.status}
              </span>
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
            <td colSpan={7} className="px-6 py-12 text-center">
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
          <Link
            href="/admin/orders/new"
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            <Icon name="add" size={16} className="mr-1" />
            New Order
          </Link>
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 rounded-xl border border-sand-border bg-surface p-4 flex items-center gap-3">
            <span className="text-sm font-sans text-muted-ink">
              {selectedIds.size} selected
            </span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="rounded-md border border-sand-border bg-white px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
            >
              <option value="">Choose action…</option>
              <option value="cancel">Cancel selected orders</option>
            </select>
            <button
              onClick={executeBulkAction}
              disabled={!bulkAction}
              className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 disabled:opacity-50 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sindoor font-medium hover:underline text-sm"
            >
              Clear selection
            </button>
            {actionError && (
              <span className="ml-4 text-xs text-red-600">{actionError}</span>
            )}
          </div>
        )}

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search order ID, customer, email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-sand-border bg-white text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium text-muted-ink mb-2 uppercase tracking-wider">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="rounded-md border border-sand-border bg-white px-4 py-2 text-sm font-sans text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-sand-border text-sindoor focus:ring-sindoor"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Email
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {orders.length} of {totalCount} orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                <Icon name="chevron-left" size={16} /> Prev
              </button>
              <span className="px-2 text-sm font-sans text-muted-ink">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                Next <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
