"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@snehavrinda-kala/ui";

interface Commission {
  id: string;
  artist_id: string;
  artist_name: string;
  amount: number;
  currency_code: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface Partner {
  id: string;
  name: string;
}

const emptyForm = {
  artist_id: "",
  amount: "",
  currency_code: "inr",
  notes: "",
};

const statusClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS = ["pending", "paid", "cancelled"];

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
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

  const loadCommissions = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/commissions?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCommissions(
          (data.payouts || data.commissions || []).map((c: any) => ({
            id: c.id || "",
            artist_id: c.artist_id || "",
            artist_name: c.artist_name || "",
            amount: Number(c.amount || 0),
            currency_code: c.currency_code || "inr",
            status: c.status || "",
            paid_at: c.paid_at || null,
            created_at: c.created_at || "",
          }))
        );
        setTotalCount(data.count ?? commissions.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT, commissions.length]);

  useEffect(() => {
    loadCommissions();
    fetch("/api/admin/partners?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setPartners(
          (data.partners || []).map((p: any) => ({
            id: p.id || "",
            name: p.name || "",
          }))
        );
      })
      .catch(() => {});
  }, [loadCommissions]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_id: form.artist_id,
          amount: Math.round(Number(form.amount) * 100),
          currency_code: form.currency_code,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payout");
      setForm(emptyForm);
      setShowForm(false);
      loadCommissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(commission: Commission, status: string) {
    setActionId(commission.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/commissions/${commission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payout");
      loadCommissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function removeCommission(commission: Commission) {
    if (
      !confirm(
        `Delete payout of ₹${(commission.amount / 100).toFixed(2)} to ${commission.artist_name}?`
      )
    )
      return;
    setActionId(commission.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/commissions/${commission.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete payout");
      loadCommissions();
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
          <p className="text-muted-ink font-sans">Loading commissions...</p>
        </div>
      </main>
    );
  }

  const commissionRows =
    commissions.length > 0
      ? commissions.map((c: Commission) => (
          <tr key={c.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{c.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {c.artist_name}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {c.currency_code?.toUpperCase()}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {(c.amount / 100).toFixed(2)}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  statusClasses[c.status] || "bg-gray-100 text-gray-600"
                }`}
              >
                {c.status}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(c.created_at).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <div className="flex items-center gap-3">
                {c.status !== "paid" && (
                  <button
                    onClick={() => updateStatus(c, "paid")}
                    disabled={actionId === c.id}
                    className="text-green-700 font-medium hover:underline disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                )}
                {c.status !== "pending" && (
                  <button
                    onClick={() => updateStatus(c, "pending")}
                    disabled={actionId === c.id}
                    className="text-sindoor font-medium hover:underline disabled:opacity-50"
                  >
                    Mark pending
                  </button>
                )}
                {c.status !== "cancelled" && (
                  <button
                    onClick={() => updateStatus(c, "cancelled")}
                    disabled={actionId === c.id}
                    className="text-red-600 font-medium hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => removeCommission(c)}
                  disabled={actionId === c.id}
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
            <td colSpan={7} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No commissions found.</p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Commissions
            </h1>
            <p className="text-muted-ink font-sans">
              Manage artist commissions and payouts.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            {showForm ? "Cancel" : "New Payout"}
          </button>
        </div>

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search artist name…"
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
              Record Commission Payout
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Artist *
                </span>
                <select
                  required
                  value={form.artist_id}
                  onChange={(e) =>
                    setForm({ ...form, artist_id: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                >
                  <option value="">Select artist…</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Amount (₹) *
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="500.00"
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Currency
                </span>
                <select
                  value={form.currency_code}
                  onChange={(e) =>
                    setForm({ ...form, currency_code: e.target.value })
                  }
                  className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                >
                  <option value="inr">INR</option>
                  <option value="usd">USD</option>
                </select>
              </label>
              <label className="block sm:col-span-3">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  Notes
                </span>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Q3 sales commission"
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
                {submitting ? "Saving..." : "Record Payout"}
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
                  ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Artist
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {commissionRows}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {commissions.length} of {totalCount} commissions
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
