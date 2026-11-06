"use client";

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

export function AdminSettingsForm() {
  const [mode, setMode] = useState<"platform" | "single-brand">("single-brand");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/set-platform-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Mode updated. Restart the storefront to apply." });
      } else {
        setMessage({ ok: false, text: "Failed to save mode." });
      }
    } catch {
      setMessage({ ok: false, text: "Error saving mode." });
    } finally {
      setSaving(false);
    }
  };

  return (
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

      {message && (
        <p
          className={`mb-6 rounded-md p-3 text-sm font-sans ${
            message.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Mode"}
      </Button>
    </form>
  );
}
