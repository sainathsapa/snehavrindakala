"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface Payout {
  id: string;
  artist_id: string;
  artist_name: string;
  amount: number;
  currency_code: string;
  status: string;
  paid_at?: string;
  created_at: string;
}

interface Artist {
  id: string;
  display_name: string;
}

export default function CommissionsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    artist_id: "",
    amount: "",
    currency_code: "inr",
    status: "pending",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/commissions", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
        setArtists(data.artists || []);
      }
    } catch (err) {
      console.error("Failed to load commissions", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_id: form.artist_id,
          amount: parseInt(form.amount) || 0,
          currency_code: form.currency_code,
          status: form.status,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Payout created." });
        setForm({ artist_id: "", amount: "", currency_code: "inr", status: "pending" });
        loadData();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create payout." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating payout." });
    } finally {
      setSaving(false);
    }
  }

  async function togglePayoutStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "pending" ? "paid" : "pending";
    try {
      await fetch("/api/admin/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      loadData();
    } catch {
      setMessage({ ok: false, text: "Failed to update payout status." });
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading commissions...</p>
        </div>
      </main>
    );
  }

  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Commissions & Payouts
          </h1>
          <p className="text-muted-ink font-sans">
            Manage artist commission payouts.
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

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-sand-border bg-surface p-6 text-center">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Pending Payouts</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">
              ₹{(totalPending / 100).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-sand-border bg-surface p-6 text-center">
            <p className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider mb-2">Paid Out</p>
            <p className="text-2xl font-serif font-bold text-deep-ink">
              ₹{(totalPaid / 100).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Create payout form */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Create Payout</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Artist</label>
              <select
                name="artist_id"
                value={form.artist_id}
                onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              >
                <option value="">Select artist</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Amount (₹)</label>
              <input
                name="amount"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Currency</label>
              <select
                name="currency_code"
                value={form.currency_code}
                onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              >
                <option value="inr">INR</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !form.artist_id}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Payout"}
            </button>
          </form>
        </div>

        {/* Payouts list */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Payout ID</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Artist</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {payouts.length > 0 ? (
                payouts.map((p: Payout) => (
                  <tr key={p.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink font-mono">
                      {p.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {p.artist_name}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
                      ₹{(p.amount / 100).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => togglePayoutStatus(p.id, p.status)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          p.status === "pending"
                            ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                            : "bg-leaf/10 text-leaf border border-leaf/20"
                        }`}
                      >
                        {p.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => togglePayoutStatus(p.id, p.status)}
                        className="text-xs font-medium text-sindoor hover:underline"
                      >
                        {p.status === "pending" ? "Mark Paid" : "Mark Pending"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">No payouts yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
