import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import {
  ENTRIES,
  PLATES,
  entriesFor,
  entryBySlug,
  hrefFor,
  neighbours,
  readingMinutes,
  relatedEntries,
  type PlateId,
} from "@/lib/learn";
import { ReadingProgress } from "@/components/learn/reading-progress";
import {
  AmbiRule,
  ChakraWatermark,
  PlateSeal,
  PulliGrid,
  ToranaMark,
} from "@/components/learn/motifs";

const PLATE_IDS = PLATES.map((plate) => plate.id);

function asPlate(value: string): PlateId | null {
  return (PLATE_IDS as string[]).includes(value) ? (value as PlateId) : null;
}

export function generateStaticParams() {
  return ENTRIES.map((entry) => ({ plate: entry.plate, slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; plate: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, plate, slug } = await params;
  const id = asPlate(plate);
  if (!id) return {};
  const entry = entryBySlug(id, slug);
  if (!entry) return {};
  return {
    title: `${entry.title} — ${entry.gloss}`,
    description: entry.definition,
    alternates: localeAlternates(`/learn/${id}/${slug}`, locale),
    openGraph: {
      title: entry.title,
      description: entry.definition,
      type: "article",
    },
  };
}

/**
 * One entry, on its own page.
 *
 * The layout follows the way this material is actually read in a book: a plate
 * mark and title, a label-like definition, the argument in paragraphs, then what
 * to look for standing in front of the work, and finally the entries this one
 * only makes sense beside.
 */
export default async function EntryPage({
  params,
}: {
  params: Promise<{ plate: string; slug: string }>;
}) {
  const { plate, slug } = await params;
  const plateId = asPlate(plate);
  if (!plateId) notFound();

  const entry = entryBySlug(plateId, slug);
  if (!entry) notFound();

  const found = PLATES.find((item) => item.id === plateId)!;
  const [t, related, nav] = await Promise.all([
    getTranslations("learn"),
    Promise.resolve(relatedEntries(entry)),
    Promise.resolve(neighbours(entry)),
  ]);
  const siblings = entriesFor(plateId);
  const minutes = readingMinutes(entry);

  return (
    <main className="bg-rang-paper">
      {/* ── masthead ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border">
        <PulliGrid className="pointer-events-none absolute inset-0 h-full w-full text-deep-ink/[0.05]" />
        <ChakraWatermark className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] text-sindoor/[0.08]" />

        <div className="relative mx-auto max-w-4xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-16">
          <nav className="flex flex-wrap items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-muted-ink">
            <Link href="/learn" className="hover:text-sindoor">
              {t("plateLabel")}
            </Link>
            <span aria-hidden>/</span>
            <Link href={`/learn/${plateId}`} className="hover:text-sindoor">
              {found.numeral} · {found.title}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-deep-ink">{entry.title}</span>
          </nav>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink/80">
                {(entry.languages ?? []).map((language) => (
                  <span key={language}>{language}</span>
                ))}
                {entry.era && (
                  <>
                    <span aria-hidden className="h-2.5 w-px bg-sand-border" />
                    <span className="text-sindoor">{entry.era}</span>
                  </>
                )}
              </div>

              <h1 className="mt-3 font-serif text-[2.6rem] leading-[1.02] text-deep-ink sm:text-6xl">
                {entry.title}
              </h1>

              <p className="mt-4 max-w-2xl font-serif text-lg italic leading-snug text-deep-ink/75 sm:text-xl">
                {entry.gloss}
              </p>
            </div>

            <PlateSeal
              numeral={found.numeral}
              label={plateId}
              className="h-20 w-20 shrink-0 text-deep-ink/60"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-sans text-[11px] uppercase tracking-[0.16em] text-muted-ink">
            <span>{minutes} min read</span>
            <span className="h-3 w-px bg-sand-border" />
            <span>{entry.source.tradition.join(" · ")}</span>
            {entry.source.period && (
              <>
                <span className="h-3 w-px bg-sand-border" />
                <span>{entry.source.period}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── body ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,42rem)_16rem] lg:gap-16">
          <article className="min-w-0">
            {/* museum label */}
            <div className="border-l-2 border-sindoor pl-5">
              <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-sindoor">
                {t("label")}
              </p>
              <p className="mt-2 font-serif text-xl leading-relaxed text-deep-ink">
                {entry.definition}
              </p>
            </div>

            <div className="mt-10 space-y-6">
              {entry.body.map((paragraph, index) => (
                <p
                  key={index}
                  className={`font-sans text-[16.5px] leading-[1.85] text-deep-ink/90 ${
                    index === 0
                      ? "first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-serif first-letter:text-[3.4rem] first-letter:leading-[0.8] first-letter:text-sindoor"
                      : ""
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* what to look for */}
            <div className="mt-14 border-t border-sand-border pt-10">
              <div className="flex items-center gap-3">
                <ToranaMark className="h-6 w-10 text-sindoor/70" />
                <h2 className="font-serif text-2xl text-deep-ink">
                  {t("lookForHeading")}
                </h2>
              </div>
              <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted-ink">
                {t("lookForBody")}
              </p>

              <ol className="mt-6 divide-y divide-sand-border/70 border-y border-sand-border/70">
                {entry.lookFor.map((item, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-[2.5rem_1fr] gap-4 py-4"
                  >
                    <span className="font-serif text-lg text-sindoor/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-sans text-[15px] leading-relaxed text-deep-ink/90">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <ReadingProgress slug={entry.slug} title={entry.title} />

            {/* prev / next */}
            <nav className="mt-12 grid gap-4 border-t border-sand-border pt-8 sm:grid-cols-2">
              {nav.previous ? (
                <Link
                  href={hrefFor(nav.previous)}
                  className="group block rounded-lg border border-sand-border bg-surface/60 p-5 transition-colors hover:border-sindoor/40"
                >
                  <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink">
                    {t("previous")}
                  </span>
                  <span className="mt-1 block font-serif text-lg text-deep-ink group-hover:text-sindoor">
                    {nav.previous.title}
                  </span>
                  <span className="mt-1 block font-sans text-xs text-muted-ink">
                    {nav.previous.gloss}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nav.next ? (
                <Link
                  href={hrefFor(nav.next)}
                  className="group block rounded-lg border border-sand-border bg-surface/60 p-5 text-right transition-colors hover:border-sindoor/40"
                >
                  <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink">
                    {t("next")}
                  </span>
                  <span className="mt-1 block font-serif text-lg text-deep-ink group-hover:text-sindoor">
                    {nav.next.title}
                  </span>
                  <span className="mt-1 block font-sans text-xs text-muted-ink">
                    {nav.next.gloss}
                  </span>
                </Link>
              ) : null}
            </nav>
          </article>

          {/* ── margin ─────────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border-t border-sand-border pt-5">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink">
                {t("inThisPlate")}
              </h2>
              <ul className="mt-3 space-y-1.5 font-sans text-sm">
                {siblings.map((item) => {
                  const active = item.slug === entry.slug;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={hrefFor(item)}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "font-medium text-sindoor"
                            : "text-muted-ink transition-colors hover:text-deep-ink"
                        }
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {related.length > 0 && (
              <div className="mt-8 border-t border-sand-border pt-5">
                <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink">
                  {t("learnBeside")}
                </h2>
                <ul className="mt-3 space-y-3">
                  {related.slice(0, 3).map((item) => (
                    <li key={item.slug}>
                      <Link href={hrefFor(item)} className="group block">
                        <span className="font-serif text-[15px] text-deep-ink group-hover:text-sindoor">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted-ink">
                          {item.gloss}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AmbiRule className="mt-8 h-5 w-full text-sindoor/30" />
          </aside>
        </div>

        {/* ── related cards ──────────────────────────────────────────── */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-sand-border pt-10">
            <h2 className="font-serif text-2xl text-deep-ink">{t("readNext")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => {
                const plateOf = PLATES.find((p) => p.id === item.plate)!;
                return (
                  <Link
                    key={item.slug}
                    href={hrefFor(item)}
                    className="group flex h-full flex-col justify-between rounded-lg border border-sand-border bg-surface/70 p-5 transition-colors hover:border-sindoor/40"
                  >
                    <div>
                      <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-ink/70">
                        Plate {plateOf.numeral}
                        {item.era ? ` · ${item.era}` : ""}
                      </span>
                      <span className="mt-2 block font-serif text-lg text-deep-ink group-hover:text-sindoor">
                        {item.title}
                      </span>
                      <span className="mt-1 block font-sans text-sm leading-relaxed text-muted-ink">
                        {item.gloss}
                      </span>
                    </div>
                    <span className="mt-4 font-sans text-[11px] uppercase tracking-[0.18em] text-sindoor">
                      {t("openEntry")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-sand-border pt-8 font-sans text-sm">
          <Link href={`/learn/${plateId}`} className="text-muted-ink hover:text-sindoor">
            ← {found.title}
          </Link>
          <Link href="/learn" className="text-muted-ink hover:text-sindoor">
            {t("allPlates")}
          </Link>
        </div>
      </section>
    </main>
  );
}
