"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function I18nPage() {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    loadTranslations(locale);
  }, [locale]);

  async function loadTranslations(loc: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/store/i18n?locale=${loc}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTranslations(data.translations || {});
      }
    } catch (err) {
      console.error("Failed to load translations", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/store/i18n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, key: newKey, value: newValue }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Translation saved." });
        setNewKey("");
        setNewValue("");
        loadTranslations(locale);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to save translation." });
      }
    } catch {
      setMessage({ ok: false, text: "Error saving translation." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            i18n / Translations
          </h1>
          <p className="text-muted-ink font-sans">
            Manage translations for different languages.
          </p>
        </div>

        <div className="flex gap-4 mb-8">
          <select value={locale} onChange={(e) => setLocale(e.target.value)}
            className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans">
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>
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
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Add Translation</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Key</label>
              <input name="key" type="text" value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. home" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">Value</label>
              <input name="value" type="text" value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g. Home" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <button type="submit" disabled={saving || !newKey || !newValue}
              className="px-6 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Add Translation"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Key</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Value ({locale})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {Object.entries(translations).length > 0 ? (
                Object.entries(translations).map(([key, value]) => (
                  <tr key={key} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink font-mono">{key}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{value}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={2} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No translations yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}