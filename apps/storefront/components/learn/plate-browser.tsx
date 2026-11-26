"use client";

/**
 * Plate browser — the interactive index for one plate.
 *
 * The requirements this answers, in order:
 *   · a reader arrives from a product page holding one word, so search is first
 *   · the same plate holds several languages and eras, so filtering is next
 *   · the plate is long, so the eye needs grouping rather than a flat list
 *   · learning is not done in one sitting, so progress is remembered locally
 *
 * Everything is keyboard operable: `/` focuses search, `Esc` clears, and the
 * cards are ordinary links so they work with the tab key and without JS.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Entry, PlateId } from "@/lib/learn/types";
import { hrefFor } from "@/lib/learn";

interface Props {
  plate: PlateId;
  entries: Entry[];
  languages: string[];
  /** Era grouping, used only by the history plate. */
  grouped?: boolean;
}

const STORAGE_KEY = "svk:learn:read";

function readProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function PlateBrowser({ plate, entries, languages, grouped = false }: Props) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [erasOpen, setErasOpen] = useState<string | null>(null);
  const [learned, setLearned] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLearned(readProgress()), []);

  // `/` jumps to search, the way a printed index invites a finger. Ignored while
  // the reader is already typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (language && !(entry.languages ?? []).includes(language)) return false;
      if (!needle) return true;
      const haystack = [
        entry.title,
        entry.gloss,
        entry.definition,
        ...entry.body,
        ...(entry.languages ?? []),
        ...entry.lookFor,
        entry.era ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, language, query]);

  const groups = useMemo(() => {
    if (!grouped) return [{ key: "", label: "", items: filtered }];
    const map = new Map<string, Entry[]>();
    for (const entry of filtered) {
      const key = entry.era ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return [...map.entries()].map(([key, items]) => ({ key, label: key, items }));
  }, [filtered, grouped]);

  const readCount = entries.filter((entry) => learned[entry.slug]).length;
  const percent = entries.length ? Math.round((readCount / entries.length) * 100) : 0;

  return (
    <div className="font-sans">
      {/* ── controls ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-sand-border bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex-1">
            <span className="sr-only">Search this plate</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a word, a material, a tradition…"
              className="w-full rounded-full border border-sand-border bg-white px-4 py-2.5 pr-16 text-sm text-deep-ink placeholder:text-muted-ink/60 focus:border-sindoor focus:outline-none focus:ring-1 focus:ring-sindoor"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-sand-border px-1.5 py-0.5 text-[10px] text-muted-ink">
              /
            </kbd>
          </label>

          <div className="flex items-center gap-3 text-xs text-muted-ink">
            <span aria-live="polite">
              {filtered.length} of {entries.length}
            </span>
            <span className="hidden h-3 w-px bg-sand-border sm:block" />
            <span className="flex items-center gap-2">
              <span className="relative block h-1 w-16 overflow-hidden rounded-full bg-sand-border">
                <span
                  className="absolute inset-y-0 left-0 bg-leaf transition-all"
                  style={{ width: `${percent}%` }}
                />
              </span>
              {readCount ? `${readCount} read` : "unread"}
            </span>
          </div>
        </div>

        {languages.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setLanguage(null)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                language === null
                  ? "border-deep-ink bg-deep-ink text-rang-paper"
                  : "border-sand-border text-muted-ink hover:border-deep-ink/40"
              }`}
            >
              All languages
            </button>
            {languages.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(language === option ? null : option)}
                aria-pressed={language === option}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  language === option
                    ? "border-sindoor bg-sindoor text-white"
                    : "border-sand-border text-muted-ink hover:border-sindoor/50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── list ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-ink">
          Nothing in this plate matches “{query}”.
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLanguage(null);
            }}
            className="ml-1 underline decoration-sindoor/40 underline-offset-4 hover:text-sindoor"
          >
            Clear the search
          </button>
        </p>
      ) : (
        <div className="divide-y divide-sand-border/70">
          {groups.map((group) => (
            <section key={group.key || "all"} className="py-2">
              {group.label && (
                <button
                  type="button"
                  onClick={() => setErasOpen(erasOpen === group.key ? null : group.key)}
                  className="group mt-6 mb-2 flex w-full items-baseline gap-3 text-left"
                >
                  <span className="font-serif text-lg text-deep-ink">{group.label}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-ink">
                    {group.items.length} {group.items.length === 1 ? "entry" : "entries"}
                  </span>
                  <span className="ml-auto text-xs text-muted-ink group-hover:text-sindoor">
                    {erasOpen === group.key ? "collapse" : ""}
                  </span>
                </button>
              )}

              <ul className="space-y-0">
                {(erasOpen === null || !group.label || erasOpen === group.key
                  ? group.items
                  : []
                ).map((entry, index) => {
                  const isRead = Boolean(learned[entry.slug]);
                  return (
                    <li key={entry.slug}>
                      <Link
                        href={hrefFor(entry)}
                        className="group grid grid-cols-[2.2rem_1fr] gap-x-3 border-t border-sand-border/50 py-5 first:border-t-0 sm:grid-cols-[2.5rem_1fr_auto] sm:items-baseline"
                      >
                        <span className="pt-1 font-serif text-sm text-muted-ink/70">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span>
                          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="font-serif text-xl text-deep-ink transition-colors group-hover:text-sindoor">
                              {entry.title}
                            </span>
                            {(entry.languages ?? []).slice(0, 2).map((item) => (
                              <span
                                key={item}
                                className="text-[10px] uppercase tracking-[0.16em] text-muted-ink/70"
                              >
                                {item}
                              </span>
                            ))}
                            {isRead && (
                              <span className="text-[10px] uppercase tracking-[0.16em] text-leaf">
                                read
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block max-w-2xl text-sm leading-relaxed text-muted-ink">
                            {entry.gloss}
                          </span>
                        </span>

                        <span className="col-start-2 mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-ink/60 sm:col-start-3 sm:mt-0">
                          {entry.source.period ?? entry.source.tradition[0]}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
