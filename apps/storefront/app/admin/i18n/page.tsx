"use client";

import { useState, useEffect } from "react";

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
};

export default function I18nPage() {
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [supported, setSupported] = useState("en,hi,te");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        const settings: any[] = data.settings || [];
        const locale = settings.find((s) => s.key === "default_locale");
        const locales = settings.find((s) => s.key === "supported_locales");
        if (locale) setDefaultLocale(locale.value || "en");
        if (locales) setSupported(locales.value || "en,hi,te");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const localeList = Array.from(
    new Set(
      supported
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
        .concat(defaultLocale)
    )
  );

  function toggleLocale(locale: string, checked: boolean) {
    const current = supported
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const next = checked
      ? Array.from(new Set([...current, locale]))
      : current.filter((l) => l !== locale);
    setSupported(next.join(","));
    if (!checked && defaultLocale === locale && next.length > 0) {
      setDefaultLocale(next[0]);
    }
  }

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
            { key: "default_locale", value: defaultLocale },
            { key: "supported_locales", value: supported },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save localization");
      setMessage("Localization settings saved.");
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
          <p className="text-muted-ink font-sans">
            Loading localization settings...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Internationalization
          </h1>
          <p className="text-muted-ink font-sans">
            Manage language and localization settings.
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
          <div className="mb-6 max-w-xs">
            <label className="block">
              <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                Default locale
              </span>
              <select
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
              >
                {localeList.map((locale) => (
                  <option key={locale} value={locale}>
                    {LOCALE_NAMES[locale] || locale} ({locale})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
              Supported locales
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {["en", "hi", "te", "ta", "kn"].map((locale) => {
                const checked = supported
                  .split(",")
                  .map((l) => l.trim())
                  .includes(locale);
                return (
                  <label
                    key={locale}
                    className="flex items-center gap-2 font-sans text-sm text-deep-ink"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locale === defaultLocale && checked}
                      onChange={(e) => toggleLocale(locale, e.target.checked)}
                      className="h-4 w-4 rounded border-sand-border"
                    />
                    {LOCALE_NAMES[locale] || locale} ({locale})
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving || localeList.length === 0}
            className="mt-6 rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Localization"}
          </button>
        </form>
      </div>
    </main>
  );
}
