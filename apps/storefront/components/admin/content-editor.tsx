"use client";

/**
 * An editor for the two editorial kinds the studio writes by hand: a room (a
 * curated grouping of work with a wall text) and a newsroom entry.
 *
 * One component covers both because the shape is the same — a title, an address,
 * a paragraph or two, a picture and a publish switch. The differences are: a room
 * points at a collection, a news entry points at an outlet and an outside link.
 * Those are the only branches below, which keeps one screen from quietly learning
 * a rule the other does not follow.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/slug";

type Kind = "rooms" | "newsroom";

interface Row {
  id: number;
  slug: string;
  title: string;
  kicker?: string;
  subtitle?: string;
  body: string;
  image: string;
  collection?: string;
  kind?: string;
  outlet?: string;
  url?: string;
  summary?: string;
  published_at?: string;
  published: boolean;
  position: number;
}

const EMPTY: Record<Kind, Partial<Row>> = {
  rooms: {
    slug: "", title: "", kicker: "", subtitle: "", body: "", image: "",
    collection: "", published: true, position: 0,
  },
  newsroom: {
    slug: "", title: "", kind: "announcement", outlet: "", url: "", summary: "",
    body: "", image: "", published: true, position: 0,
  },
};

const KIND_LABEL: Record<string, string> = {
  press: "Press release",
  coverage: "Coverage",
  announcement: "Announcement",
};

const label = "block font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink";
const field =
  "mt-1 w-full rounded-md border border-sand-border bg-rang-paper px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

export function ContentEditor({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Partial<Row>>(EMPTY[kind]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const noun = kind === "rooms" ? "room" : "entry";
  const title = kind === "rooms" ? "Rooms" : "Newsroom";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/content/${kind}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load");
      setRows(data.items || []);
    } catch (error) {
      setNote({ ok: false, text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // The address follows the title until someone edits it, then it is theirs.
  useEffect(() => {
    if (!touched) setForm((f) => ({ ...f, slug: slugify(String(f.title || "")) }));
  }, [touched, form.title]);

  const pending = useMemo(() => rows.filter((row) => !row.published).length, [rows]);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const isEdit = Boolean(form.id);
      const response = await fetch(`/api/admin/content/${kind}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save");
      setNote({ ok: true, text: isEdit ? `Saved “${data.item.title}”.` : `Added “${data.item.title}”.` });
      setForm(EMPTY[kind]);
      setTouched(false);
      await load();
    } catch (error) {
      setNote({ ok: false, text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(row: Row) {
    const response = await fetch(`/api/admin/content/${kind}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, published: !row.published }),
    });
    if (response.ok) await load();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Remove “${row.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/content/${kind}?id=${row.id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className="rounded-lg border border-sand-border bg-surface p-5">
        <h2 className="font-serif text-xl text-deep-ink">
          {form.id ? `Edit ${noun}` : `New ${noun}`}
        </h2>
        <p className="mt-1 font-sans text-xs text-muted-ink">
          {kind === "rooms"
            ? "A room is a wall: a title, a wall text, and the collection hanging in it."
            : "A newsroom entry is a headline and where it appeared. The link leaves the site."}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className={label} htmlFor="title">Title</label>
            <input
              id="title"
              className={field}
              value={String(form.title || "")}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={kind === "rooms" ? "The Monsoon Room" : "SnehaVrinda Kala opens in Bikaner"}
            />
          </div>

          <div>
            <label className={label} htmlFor="slug">Web address</label>
            <input
              id="slug"
              className={`${field} font-mono`}
              value={String(form.slug || "")}
              onChange={(e) => {
                setTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
            />
            <p className="mt-1 font-sans text-[11px] text-muted-ink">
              /{kind === "rooms" ? "rooms" : "newsroom"}/{form.slug || "…"}
              {touched ? " · kept as typed" : " · follows the title"}
            </p>
          </div>

          {kind === "rooms" ? (
            <>
              <div>
                <label className={label} htmlFor="kicker">Kicker</label>
                <input
                  id="kicker"
                  className={field}
                  value={String(form.kicker || "")}
                  onChange={(e) => setForm((f) => ({ ...f, kicker: e.target.value }))}
                  placeholder="Room One"
                />
              </div>
              <div>
                <label className={label} htmlFor="subtitle">Subtitle</label>
                <input
                  id="subtitle"
                  className={field}
                  value={String(form.subtitle || "")}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Work made for the rains"
                />
              </div>
              <div>
                <label className={label} htmlFor="collection">Collection handle</label>
                <input
                  id="collection"
                  className={`${field} font-mono`}
                  value={String(form.collection || "")}
                  onChange={(e) => setForm((f) => ({ ...f, collection: e.target.value }))}
                  placeholder="monsoon"
                />
                <p className="mt-1 font-sans text-[11px] text-muted-ink">
                  The products whose collection handle matches appear in the room. Leave
                  it blank for a room with no stock yet.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={label} htmlFor="kind">Kind</label>
                <select
                  id="kind"
                  className={field}
                  value={String(form.kind || "announcement")}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                >
                  {Object.entries(KIND_LABEL).map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="outlet">Outlet</label>
                <input
                  id="outlet"
                  className={field}
                  value={String(form.outlet || "")}
                  onChange={(e) => setForm((f) => ({ ...f, outlet: e.target.value }))}
                  placeholder="The Hindu"
                />
              </div>
              <div>
                <label className={label} htmlFor="url">Link to the piece</label>
                <input
                  id="url"
                  className={`${field} font-mono`}
                  value={String(form.url || "")}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                />
                <p className="mt-1 font-sans text-[11px] text-muted-ink">
                  Only http and https links are followed; anything else is shown as text.
                </p>
              </div>
              <div>
                <label className={label} htmlFor="summary">Summary</label>
                <textarea
                  id="summary"
                  rows={2}
                  className={field}
                  value={String(form.summary || "")}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                />
              </div>
            </>
          )}

          <div>
            <label className={label} htmlFor="body">Text</label>
            <textarea
              id="body"
              rows={6}
              className={field}
              value={String(form.body || "")}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Blank lines separate paragraphs."
            />
          </div>

          <div>
            <label className={label} htmlFor="image">Image URL</label>
            <input
              id="image"
              className={`${field} font-mono`}
              value={String(form.image || "")}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
              placeholder="/plates/words.webp"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 font-sans text-sm text-deep-ink">
              <input
                type="checkbox"
                checked={form.published !== false}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              />
              Published
            </label>
            <label className="flex items-center gap-2 font-sans text-sm text-deep-ink">
              Order
              <input
                type="number"
                className="w-20 rounded-md border border-sand-border bg-rang-paper px-2 py-1 font-sans text-sm"
                value={Number(form.position || 0)}
                onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) || 0 }))}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={busy || !form.title}
              className="min-h-11 rounded-full bg-sindoor px-5 font-sans text-sm font-medium text-rang-paper disabled:opacity-50"
            >
              {busy ? "Saving…" : form.id ? "Save changes" : `Add ${noun}`}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={() => { setForm(EMPTY[kind]); setTouched(false); }}
                className="min-h-11 rounded-full border border-sand-border px-5 font-sans text-sm text-deep-ink"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {note ? (
            <p
              role="status"
              className={`font-sans text-sm ${note.ok ? "text-kumkum" : "text-sindoor"}`}
            >
              {note.text}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl text-deep-ink">{title}</h2>
          <p className="font-sans text-xs text-muted-ink">
            {rows.length} total{pending > 0 ? ` · ${pending} unpublished` : ""}
          </p>
        </div>

        {loading ? (
          <p className="mt-6 font-sans text-sm text-muted-ink">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-sand-border p-8 text-center">
            <p className="font-serif text-lg text-deep-ink">Nothing here yet</p>
            <p className="mt-1 font-sans text-sm text-muted-ink">
              {kind === "rooms"
                ? "A room can be empty while you gather the work for it."
                : "Press mentions and announcements appear here, newest first."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-sand-border border-y border-sand-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-base text-deep-ink">{row.title}</p>
                  <p className="font-mono text-[11px] text-muted-ink">
                    /{kind === "rooms" ? "rooms" : "newsroom"}/{row.slug}
                    {row.outlet ? ` · ${row.outlet}` : ""}
                    {row.kind && kind === "newsroom" ? ` · ${KIND_LABEL[row.kind] || row.kind}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] ${
                    row.published
                      ? "bg-kumkum/10 text-kumkum"
                      : "bg-sand-border/30 text-muted-ink"
                  }`}
                >
                  {row.published ? "Live" : "Draft"}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setForm(row); setTouched(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="min-h-9 rounded-full border border-sand-border px-3 font-sans text-xs text-deep-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublish(row)}
                    className="min-h-9 rounded-full border border-sand-border px-3 font-sans text-xs text-deep-ink"
                  >
                    {row.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    className="min-h-9 rounded-full border border-sand-border px-3 font-sans text-xs text-sindoor"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
