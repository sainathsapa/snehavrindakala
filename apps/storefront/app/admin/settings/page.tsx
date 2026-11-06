"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@snehavrinda-kala/ui";

interface ModeOption {
  value: "platform" | "single-brand";
  label: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    value: "single-brand",
    label: "Single Brand",
    description:
      "SnehaVrinda Kala is the sole seller. Admin manages everything directly.",
  },
  {
    value: "platform",
    label: "Multi-vendor Platform",
    description:
      "SnehaVrinda Kala hosts multiple artists/partners who manage their own listings.",
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const [mode, setMode] = useState<"platform" | "single-brand">("single-brand");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMode();
  }, []);

  async function loadMode() {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMode(data.mode || "single-brand");
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        window.location.href = "/admin/settings?saved=1";
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight">
            Platform Settings
          </h1>
          <p className="mt-2 text-muted-ink font-sans">
            Choose whether SnehaVrinda Kala operates as a single-brand store
            or a multi-vendor platform.
          </p>
        </div>

        {saved === "1" && (
          <p className="mb-6 rounded-md p-3 text-sm font-sans bg-green-50 text-green-800 border border-green-200">
            Settings saved successfully.
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-6">
              Operating Mode
            </h2>
            <div className="space-y-4">
              {MODES.map((m) => {
                const isSelected = mode === m.value;
                return (
                  <label
                    key={m.value}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? "border-sindoor bg-sindoor/5"
                        : "border-sand-border hover:border-sindoor/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="platformMode"
                      value={m.value}
                      checked={isSelected}
                      onChange={() => setMode(m.value)}
                      className="sr-only peer"
                    />
                    <div className="flex items-start gap-3 peer-checked:font-sans">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isSelected ? "text-sindoor" : "text-muted-ink"
                          }`}
                        >
                          {m.label}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium border border-sindoor text-sindoor bg-sindoor/10">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-ink font-sans leading-relaxed">
                        {m.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-ink font-sans">
              Changing modes requires a storefront restart to take effect. Update
              the PLATFORM_MODE environment variable or use this toggle and then
              restart the container.
            </p>
          </div>

          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-6">
              Environment Variable
            </h2>
            <p className="text-muted-ink font-sans mb-3">
              For production deployment, set this in your .env or hosting platform:
            </p>
            <div className="bg-rang-paper rounded-md p-4 font-sans text-sm text-deep-ink font-mono border border-sand-border">
              PLATFORM_MODE={mode}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </form>
      </div>
    </main>
  );
}
