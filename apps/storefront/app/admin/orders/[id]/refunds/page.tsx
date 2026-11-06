"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@snehavrinda-kala/ui";

interface Refund {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export default function OrderRefundsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });

  useEffect(() => {
    if (id) loadRefunds(id);
  }, [id]);

  async function loadRefunds(orderId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setRefunds(data.refunds || []);
      }
    } catch (err) {
      console.error("Failed to load refunds", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseInt(form.amount) || 0, reason: form.reason }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Refund created." });
        setForm({ amount: "", reason: "" });
        loadRefunds(id);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create refund." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating refund." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading refunds...</p>
        </div>
      </main>
    );
  }

  const totalRefunded = refunds
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4">
            ← Back to Orders
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Refund Management
          </h1>
          <p className="text-muted-ink font-sans">Manage refunds for order #{id.slice(-8)}</p>
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

        {/* Create refund */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Create Refund</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Amount (₹)</label>
              <input name="amount" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Reason</label>
              <input name="reason" type="text" value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Damaged item" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create Refund"}
            </button>
          </form>
        </div>

        {/* Refunds list */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Refund ID</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Reason</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {refunds.length > 0 ? (
                refunds.map((r: any) => (
                  <tr key={r.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink font-mono">{r.id.slice(-8)}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">₹{(r.amount/100).toLocaleString()}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{r.reason}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                        r.status === "completed" ? "bg-leaf/10 text-leaf border border-leaf/20" : "bg-terracotta/10 text-terracotta border border-terracotta/20"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No refunds yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-sand-border bg-surface p-6 text-center">
          <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Total Refunded</p>
          <p className="text-2xl font-serif font-bold text-deep-ink">₹{(totalRefunded/100).toLocaleString()}</p>
        </div>
      </div>
    </main>
  );
}