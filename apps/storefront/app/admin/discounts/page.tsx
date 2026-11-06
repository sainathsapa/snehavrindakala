"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface Discount {
  id: string;
  code: string;
  type: string;
  value: string;
  min_order_amount: string;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    min_order_amount: "0",
    usage_limit: "0",
    starts_at: "",
    ends_at: "",
  });

  useEffect(() => {
    loadDiscounts();
  }, []);

  async function loadDiscounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/discounts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.discounts || []);
      }
    } catch (err) {
      console.error("Failed to load discounts", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          type: form.type,
          value: form.value,
          min_order_amount: form.min_order_amount,
          usage_limit: parseInt(form.usage_limit) || 0,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Discount code created." });
        setForm({ code: "", type: "percentage", value: "", min_order_amount: "0", usage_limit: "0", starts_at: "", ends_at: "" });
        loadDiscounts();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create discount." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating discount." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscount(id: string, isActive: boolean) {
    try {
      await fetch("/api/admin/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !isActive }),
      });
      loadDiscounts();
    } catch {
      setMessage({ ok: false, text: "Failed to toggle discount." });
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading discounts...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Discount Codes
          </h1>
          <p className="text-muted-ink font-sans">
            Manage promo codes and discounts.
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

        {/* Create form */}
        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Create Discount Code</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Code</label>
              <input
                name="code"
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. WELCOME10"
                required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Type</label>
              <select
                name="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Value</label>
              <input
                name="value"
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 10 or 500"
                required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Min Order</label>
              <input
                name="min_order_amount"
                type="number"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Code"}
            </button>
          </form>
        </div>

        {/* Discounts list */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Value</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Min Order</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Usage</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {discounts.length > 0 ? (
                discounts.map((d: Discount) => (
                  <tr key={d.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink font-mono">{d.code}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink capitalize">{d.type}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{d.type === "percentage" ? `${d.value}%` : `₹${d.value}`}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">₹${d.min_order_amount}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{d.used_count} / {d.usage_limit || "∞"}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleDiscount(d.id, d.is_active)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          d.is_active
                            ? "bg-leaf/10 text-leaf border border-leaf/20"
                            : "bg-sindoor/10 text-sindoor border border-sindoor/20"
                        }`}
                      >
                        {d.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleDiscount(d.id, d.is_active)}
                        className="text-xs font-medium text-sindoor hover:underline"
                      >
                        {d.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">No discount codes yet.</p>
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
