"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { GlossaryTerm } from "@/lib/art-reference";

/**
 * The glossary, made searchable.
 *
 * As a flat list this was the weakest part of /learn: seventeen words in
 * alphabetical order, no way to find one, and nothing to do but scroll. A
 * learner arriving from a product page with one word in mind had to hunt for it.
 *
 * Now it filters as you type across the term, its meaning and its note, and by
 * language of origin. The language chips are built from the data rather than
 * hardcoded, so adding a term in a new language extends the filter on its own.
 */
export function GlossaryExplorer({
  entries,
  hrefs = {},
}: {
  entries: GlossaryTerm[];
  /**
   * Long-form page per term, keyed by the term itself.
   *
   * A plain object rather than a callback: this is a client component, and a
   * function cannot be passed across the server/client boundary.
   */
  hrefs?: Record<string, string>;
}) {
  const t = useTranslations("learn");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string | null>(null);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      // "Hindi / Urdu" is two languages for a reader's purposes.
      for (const part of entry.language.split("/")) set.add(part.trim());
    }
    return [...set].sort();
  }, [entries]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (
        language &&
        !entry.language
          .split("/")
          .map((p) => p.trim())
          .includes(language)
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        entry.term.toLowerCase().includes(needle) ||
        entry.meaning.toLowerCase().includes(needle) ||
        entry.note.toLowerCase().includes(needle) ||
        entry.language.toLowerCase().includes(needle)
      );
    });
  }, [entries, query, language]);

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-sand-border/60 py-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex w-full sm:max-w-xs">
          <span className="sr-only">{t("searchGlossary")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search a word or a meaning"
            className="w-full border-b border-sand-border bg-transparent pb-2 pr-7 font-serif text-base text-deep-ink placeholder:italic placeholder:text-muted-ink/70 focus:border-terracotta focus:outline-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 text-terracotta"
          >
            ✦
          </span>
        </label>

        <p
          className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-ink"
          aria-live="polite"
        >
          {matches.length} of {entries.length} words
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLanguage(null)}
          aria-pressed={language === null}
          className={`rounded-full border px-3 py-1 font-sans text-[11px] transition-colors ${
            language === null
              ? "border-terracotta bg-terracotta text-rang-paper"
              : "border-sand-border text-muted-ink hover:border-terracotta/50 hover:text-deep-ink"
          }`}
        >
          {t("allLanguages")}
        </button>
        {languages.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setLanguage(language === name ? null : name)}
            aria-pressed={language === name}
            className={`rounded-full border px-3 py-1 font-sans text-[11px] transition-colors ${
              language === name
                ? "border-terracotta bg-terracotta text-rang-paper"
                : "border-sand-border text-muted-ink hover:border-terracotta/50 hover:text-deep-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <p className="mt-10 border-t border-sand-border/60 pt-6 font-serif text-lg italic text-muted-ink">
          Nothing here matches that. Try a shorter word, or clear the filter.
        </p>
      ) : (
        <dl className="mt-8 divide-y divide-sand-border/60 border-b border-sand-border/60">
          {matches.map((entry) => (
            <div
              key={entry.term}
              className="group grid gap-2 py-5 transition-colors hover:bg-surface/40 sm:grid-cols-[190px_1fr] sm:gap-8"
            >
              <div>
                <dt className="font-serif text-lg font-semibold leading-tight text-deep-ink">
                  {entry.term}
                </dt>
                <span className="mt-1 block font-sans text-[9px] uppercase tracking-[0.2em] text-terracotta/75">
                  {entry.language}
                </span>
              </div>
              <dd>
                <p className="font-serif text-[15px] leading-snug text-deep-ink/90">
                  {entry.meaning}
                </p>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                  {entry.note}
                </p>
                {(() => {
                  const href = hrefs[entry.term];
                  if (!href) return null;
                  return (
                    <a
                      href={href}
                      className="mt-2 inline-block font-sans text-[10px] uppercase tracking-[0.18em] text-terracotta/80 underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                    >
                      Read the full entry →
                    </a>
                  );
                })()}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
