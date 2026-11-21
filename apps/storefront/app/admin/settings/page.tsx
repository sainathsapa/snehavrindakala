"use client";

import { useState, useEffect, useCallback } from "react";

interface Setting {
  key: string;
  value: string;
  description: string;
}

interface ConfigItem {
  id: string;
  label: string;
  level: "ready" | "partial" | "missing";
  detail: string;
  impact?: string;
  keys?: string[];
}

const LEVEL_STYLE: Record<ConfigItem["level"], string> = {
  ready: "bg-leaf/10 text-leaf border-leaf/20",
  partial: "bg-terracotta/10 text-terracotta border-terracotta/20",
  missing: "bg-sindoor/10 text-sindoor border-sindoor/20",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [mode, setMode] = useState("single-brand");
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [config, setConfig] = useState<ConfigItem[]>([]);

  const loadSettings = useCallback(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setMode(data.mode || "single-brand");
        setSettings(
          (data.settings || []).map((s: any) => ({
            key: s.key || "",
            value: s.value ?? "",
            description: s.description || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    // Presence-only: the endpoint reports whether variables are set, never their
    // values.
    fetch("/api/admin/config-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => setConfig(data.items || []))
      .catch(() => setConfig([]));
  }, []);

  function updateValue(key: string, value: string) {
    setSettings((current) =>
      current.map((s) => (s.key === key ? { ...s, value } : s))
    );
  }

  async function saveMode(e: React.FormEvent) {
    e.preventDefault();
    setSavingMode(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save mode");
      setMode(data.mode);
      setMessage("Platform mode saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingMode(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setSettings(
        (data.settings || []).map((s: any) => ({
          key: s.key || "",
          value: s.value ?? "",
          description: s.description || "",
        }))
      );
      setMessage("Settings saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Settings
            </h1>
            <p className="text-muted-ink font-sans">Configure system settings.</p>
          </div>
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

        {/* What this deployment can actually do. Every gap in DEPLOY.md was
            invisible from inside the shop: payments looked wired because
            checkout rendered, email looked wired because orders completed. */}
        {config.length > 0 && (
          <section
            aria-labelledby="configuration-heading"
            className="mb-6 rounded-xl border border-sand-border bg-surface p-6"
          >
            <h2
              id="configuration-heading"
              className="mb-1 text-lg font-serif font-semibold text-deep-ink"
            >
              What this shop can do
            </h2>
            <p className="mb-4 font-sans text-sm text-muted-ink">
              Presence of configuration, not proof it works. Nothing here shows a
              secret value.
            </p>
            <ul className="space-y-3">
              {config.map((item) => (
                <li key={item.id} className="border-b border-sand-border/60 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-sans text-sm font-medium text-deep-ink">
                      {item.label}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${
                        LEVEL_STYLE[item.level]
                      }`}
                    >
                      {item.level}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-sm text-muted-ink">{item.detail}</p>
                  {item.impact && (
                    <p className="mt-1 font-sans text-xs text-muted-ink/80">
                      {item.impact}
                    </p>
                  )}
                  {item.keys && item.keys.length > 0 && item.level !== "ready" && (
                    <p className="mt-1 font-mono text-[11px] text-muted-ink/70">
                      {item.keys.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <form
          onSubmit={saveMode}
          className="mb-6 rounded-xl border border-sand-border bg-surface p-6"
        >
          <h2 className="mb-1 text-lg font-serif font-semibold text-deep-ink">
            Platform Mode
          </h2>
          <p className="mb-4 font-sans text-sm text-muted-ink">
            Single-brand storefront or multi-vendor platform mode.
          </p>
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                Mode
              </span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
              >
                <option value="single-brand">Single brand</option>
                <option value="platform">Multi-vendor platform</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={savingMode}
              className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
            >
              {savingMode ? "Saving..." : "Save Mode"}
            </button>
          </div>
        </form>

        <form
          onSubmit={saveSettings}
          className="rounded-xl border border-sand-border bg-surface p-6"
        >
          <h2 className="mb-1 text-lg font-serif font-semibold text-deep-ink">
            Store Settings
          </h2>
          <p className="mb-4 font-sans text-sm text-muted-ink">
            These values are used across the storefront and admin panel.
          </p>

          <div className="space-y-4">
            {settings.map((s) => (
              <label key={s.key} className="block">
                <span className="mb-1 block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">
                  {s.key}
                </span>
                <input
                  value={s.value}
                  onChange={(e) => updateValue(s.key, e.target.value)}
                  className="w-full max-w-xl rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink"
                />
                {s.description && (
                  <span className="mt-1 block font-sans text-xs text-muted-ink">
                    {s.description}
                  </span>
                )}
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="mt-6 rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </main>
  );
}
