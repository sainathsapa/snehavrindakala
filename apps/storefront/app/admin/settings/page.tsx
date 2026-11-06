"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Setting {
  key: string;
  value: string;
  description: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setSettings(
          (data.settings || []).map((s: any) => ({
            key: s.key || "",
            value: s.value || "",
            description: s.description || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading settings...</p>
        </div>
      </main>
    );
  }

  const settingRows =
    settings.length > 0
      ? settings.map((s: Setting) => (
          <tr key={s.key} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {s.key}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {s.value}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {s.description}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={3} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No settings found.
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Settings
            </h1>
            <p className="text-muted-ink font-sans">
              Configure system settings.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Key
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {settingRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}