"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PartnerEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [form, setForm] = useState({
    display_name: "",
    slug: "",
    bio: "",
    region: "",
    contact_email: "",
    phone: "",
    status: "pending",
    commission_available: false,
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    fetch(`/api/admin/partners/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data: any) => {
        const artist = data.artist || data;
        setForm({
          display_name: artist.display_name || "",
          slug: artist.slug || "",
          bio: artist.bio || "",
          region: artist.region || "",
          contact_email: artist.contact_email || "",
          phone: artist.phone || "",
          status: artist.status || "pending",
          commission_available: artist.commission_available ?? false,
        });
        setLoading(false);
      })
      .catch(() => {
        setMessage({ ok: false, text: "Partner not found." });
        setLoading(false);
      });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Partner updated successfully." });
        setTimeout(() => router.push("/admin/partners"), 800);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          ok: false,
          text: data.error || "Failed to update partner.",
        });
      }
    } catch {
      setMessage({ ok: false, text: "Failed to update partner." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this partner?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/partners");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          ok: false,
          text: data.error || "Failed to delete partner.",
        });
        setSaving(false);
      }
    } catch {
      setMessage({ ok: false, text: "Failed to delete partner." });
      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor";

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading partner...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/partners"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Partners
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Edit Partner
          </h1>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm font-sans ${
              message.ok
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-sand-border bg-surface p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Slug
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Region
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Contact Email
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm({ ...form, contact_email: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-sans font-medium text-deep-ink">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                className={inputClass}
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-3 text-sm font-sans text-deep-ink">
              <input
                type="checkbox"
                checked={form.commission_available}
                onChange={(e) =>
                  setForm({
                    ...form,
                    commission_available: e.target.checked,
                  })
                }
                className="h-4 w-4"
              />
              Available for custom commissions
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sindoor px-5 py-2.5 text-sm font-sans font-medium text-white hover:bg-sindoor/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded-md border border-red-300 px-5 py-2.5 text-sm font-sans font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete Partner
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
