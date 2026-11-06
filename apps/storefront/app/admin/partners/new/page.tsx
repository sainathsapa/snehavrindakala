"use client";

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

export default function PartnerCreatePage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    display_name: "",
    slug: "",
    bio: "",
    disciplines: "",
    techniques: "",
    commission_available: false,
    status: "approved",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name,
          slug: form.slug,
          bio: form.bio,
          disciplines: form.disciplines ? form.disciplines.split(",").map((d: string) => d.trim()).filter(Boolean) : [],
          techniques: form.techniques ? form.techniques.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          commission_available: form.commission_available,
          status: form.status,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Partner created successfully." });
        setTimeout(() => {
          window.location.href = "/admin/partners";
        }, 1000);
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to create partner." });
      }
    } catch {
      setMessage({ ok: false, text: "Error creating partner." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/partners"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Partners
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Add Partner
          </h1>
          <p className="text-muted-ink font-sans">
            Onboard a new artist or partner to the platform.
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

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
              Partner Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Display Name
                </label>
                <input
                  name="display_name"
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="e.g. Aanya Desai"
                  required
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Slug (URL identifier)
                </label>
                <input
                  name="slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="e.g. aanya-desai"
                  required
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  placeholder="Tell us about this artist..."
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Disciplines (comma-separated)
                </label>
                <input
                  name="disciplines"
                  type="text"
                  value={form.disciplines}
                  onChange={(e) => setForm({ ...form, disciplines: e.target.value })}
                  placeholder="e.g. Painting, Illustration, Textile"
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-deep-ink">
                  Techniques (comma-separated)
                </label>
                <input
                  name="techniques"
                  type="text"
                  value={form.techniques}
                  onChange={(e) => setForm({ ...form, techniques: e.target.value })}
                  placeholder="e.g. Mineral pigments, Handloom weaving"
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-sans font-medium text-deep-ink">
                    Status
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
                  >
                    <option value="approved">Approved (Enabled)</option>
                    <option value="suspended">Suspended (Disabled)</option>
                  </select>
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.commission_available}
                      onChange={() =>
                        setForm({ ...form, commission_available: !form.commission_available })
                      }
                      className="rounded border text-sindoor focus:ring-sindoor"
                    />
                    <span className="text-sm font-sans text-deep-ink">
                      Available for commissions
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="w-auto px-8 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Partner"}
            </Button>
            <Link
              href="/admin/partners"
              className="px-6 py-3 border border-sand-border text-deep-ink rounded-xl font-medium hover:bg-rang-paper transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
