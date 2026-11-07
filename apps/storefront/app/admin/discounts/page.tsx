"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@snehavrinda-kala/ui";

interface Discount {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_amount: number;
  usage_limit: number;
  used_count: number;
  expires_at: string | null;
  status: string;
}

const emptyForm = {
  code: "",
  type: "percentage",
  value: "",
  min_order_amount: "0",
  usage_limit: "0",
  ends_at: "",
};

const STATUS_OPTIONS = ["active", "inactive"];

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const loadDiscounts = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/discounts?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setDiscounts(
          (data.discounts || []).map((d: any) => ({
            id: d.id || "",
            code: d.code || "",
            type: d.type || "",
            value: d.value || 0,
            min_order_amount: Number(d.min_order_amount || 0),
            usage_limit: Number(d.usage_limit || 0),
            used_count: Number(d.used_count || 0),
            expires_at: d.ends_at || d.expires_at || null,
            status: d.is_active === false ? "inactive" : "active",
          }))
        );
        setTotalCount(data.count ?? discounts.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT, discounts.length]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          value: Number(form.value),
          min_order_amount: Number(form.min_order_amount || 0),
          usage_limit: Number(form.usage_limit || 0),
          ends_at: form.ends_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create discount");
      setForm(emptyForm);
      setShowForm(false);
      loadDiscounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(discount: Discount) {
    setActionId(discount.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: discount.status !== "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update discount");
      loadDiscounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function removeDiscount(discount: Discount) {
    if (!confirm(`Delete discount ${discount.code}?`)) return;
    setActionId(discount.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete discount");
      loadDiscounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading discounts...</p>
        </div>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const discountRows =
    discounts.length > 0
      ? discounts.map((d: Discount) => (
          <tr key={d.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {d.code}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {d.type}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {d.type === "percentage" ? `${d.value}%` : `₹${d.value}`}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink text-right">
              {d.min_order_amount > 0 ? `₹${d.min_order_amount}` : "—"}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {d.used_count}
              {d.usage_limit > 0 ? ` / ${d.usage_limit}` : ""}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  d.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {d.status}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {d.expires_at ? new Date(d.expires_at).toLocaleDateString() : "Never"}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(d)}
                  disabled={actionId === d.id}
                  className="text-sindoor font-medium hover:underline disabled:opacity-50"
                >
                  {d.status === "active" ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => removeDiscount(d)}
                  disabled={actionId === d.id}
                  className="text-red-600 font-medium hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={8} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No discounts found.</p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Discounts
            </h1>
            <p className="text-muted-ink font-sans">Manage discount codes.</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            {showForm ? "Cancel" : "New Discount"}
          </button>
        </div>

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search discount code…"
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

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border border-sand-border bg-surface p-6"
          >
            <h2 className="mb-4 text-lg font-serif font-semibold text-deep-ink">
              Create Discount Code
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Code *
                </span>
                <input
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="WELCOME10"
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Type *
                </span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Value *
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === "percentage" ? "10" : "250"}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Min order amount
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.min_order_amount}
                  onChange={(e) =>
                    setForm({ ...form, min_order_amount: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Usage limit (0 = unlimited)
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.usage_limit}
                  onChange={(e) =>
                    setForm({ ...form, usage_limit: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Expires on
                </span>
                <input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Discount"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-sand-border px-4 py-2 text-sm font-sans font-medium text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Value
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Min order
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Used
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">{discountRows}</tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {discounts.length} of {totalCount} discounts
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
