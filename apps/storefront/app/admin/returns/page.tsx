"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface ReturnRequest {
  id: string;
  order_id: string;
  customer_id: string;
  customer_email: string;
  reason: string;
  status: string;
  items: string;
  created_at: string;
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    order_id: "",
    customer_email: "",
    reason: "",
    items: "",
  });

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/returns", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
      }
    } catch (err) {
      console.error("Failed to load returns", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: form.order_id,
          customer_email: form.customer_email,
          reason: form.reason,
          items: form.items,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Return request created." });
        setForm({ order_id: "", customer_email: "", reason: "", items: "" });
        loadReturns();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create return." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating return." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "pending" ? "approved" : "pending";
    try {
      await fetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadReturns();
    } catch {
      setMessage({ ok: false, text: "Failed to update return status." });
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading returns...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Return Requests
          </h1>
          <p className="text-muted-ink font-sans">
            Manage product return requests.
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

        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Create Return Request</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Order ID</label>
              <input name="order_id" type="text" value={form.order_id}
                onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                placeholder="e.g. ord_12345" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Customer Email</label>
              <input name="customer_email" type="email" value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                required className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Reason</label>
              <input name="reason" type="text" value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Wrong size" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Items (comma-separated)</label>
              <input name="items" type="text" value={form.items}
                onChange={(e) => setForm({ ...form, items: e.target.value })}
                placeholder="e.g. Variant A, Variant B"
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create Return"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Return ID</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Customer Email</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Reason</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {returns.length > 0 ? (
                returns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink font-mono">{r.id.slice(-8)}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{r.order_id}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{r.customer_email}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{r.reason}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleStatus(r.id, r.status)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          r.status === "pending" ? "bg-terracotta/10 text-terracotta border border-terracotta/20" : "bg-leaf/10 text-leaf border border-leaf/20"
                        }`}>
                        {r.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => toggleStatus(r.id, r.status)}
                        className="text-xs font-medium text-sindoor hover:underline">
                        {r.status === "pending" ? "Approve" : "Reopen"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No return requests yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}