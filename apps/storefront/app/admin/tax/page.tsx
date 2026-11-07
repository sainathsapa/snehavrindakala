"use client";

import { useState, useEffect } from "react";

export default function TaxPage() {
  const [taxRate, setTaxRate] = useState("0");
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const settings: any[] = data.settings || [];
        const rate = settings.find((s) => s.key === "tax_rate");
        const included = settings.find((s) => s.key === "tax_included");
        if (rate) setTaxRate(rate.value ?? "0");
        if (included) setTaxIncluded(included.value === "true");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "tax_rate", value: taxRate },
            { key: "tax_included", value: taxIncluded ? "true" : "false" },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tax settings");
      setMessage("Tax settings saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading tax settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Tax Settings
          </h1>
          <p className="text-muted-ink font-sans">
            Manage the default tax rate applied to orders.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 font-sans text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="rounded-xl border border-sand-border bg-surface p-6"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                Default tax rate (%)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
              />
            </label>
            <label className="flex items-start gap-3 pt-6">
              <input
                type="checkbox"
                checked={taxIncluded}
                onChange={(e) => setTaxIncluded(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-sand-border"
              />
              <span className="font-sans text-sm text-deep-ink">
                Prices include tax
                <span className="mt-0.5 block text-xs text-muted-ink">
                  When enabled, listed product prices are treated as tax
                  inclusive.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Tax Settings"}
          </button>
        </form>
      </div>
    </main>
  );
}
