import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { ENTRIES, PLATES, plateCount, entriesFor } from "@/lib/learn";
import { AmbiRule, ChakraWatermark, PlateSeal, PulliGrid } from "@/components/learn/motifs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("learn");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates("/learn", locale),
  };
}

/**
 * The contents spread.
 *
 * Three plates, fifty entries, one reading order. It is a book's opening pages
 * rather than a feature grid: the point is that a reader can see how much there
 * is and where to start.
 */
export default async function LearnPage() {
  const t = await getTranslations("learn");

  return (
    <main className="bg-rang-paper">
      {/* ── opening ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border">
        <PulliGrid className="pointer-events-none absolute inset-0 h-full w-full text-deep-ink/[0.07]" />
        <ChakraWatermark className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] text-sindoor/20" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="font-sans text-[11px] uppercase tracking-[0.32em] text-sindoor">
            {t("kicker")}
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] text-deep-ink sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-muted-ink">
            {t("intro")}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
            <span>{ENTRIES.length} entries</span>
            <span className="h-3 w-px bg-sand-border" />
            <span>3 plates</span>
            <span className="h-3 w-px bg-sand-border" />
            <span>{t("everyEntryOwnPage")}</span>
          </div>
        </div>
      </section>

      {/* ── plates ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:gap-16">
          {PLATES.map((plate) => {
            const entries = entriesFor(plate.id);
            return (
              <article
                key={plate.id}
                className="group grid gap-6 border-t border-sand-border pt-10 lg:grid-cols-[8rem_1fr_16rem] lg:gap-10"
              >
                <div className="flex items-start gap-4 lg:block">
                  <PlateSeal
                    numeral={plate.numeral}
                    label={plate.id}
                    className="h-20 w-20 shrink-0 text-deep-ink/70"
                  />
                  <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-muted-ink lg:mt-3 lg:block">
                    {plateCount(plate.id)} entries
                  </span>
                </div>

                <div>
                  <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-sindoor">
                    {plate.kicker}
                  </p>
                  <h2 className="mt-2 font-serif text-3xl leading-tight text-deep-ink sm:text-4xl">
                    <Link href={`/learn/${plate.id}`} className="hover:text-sindoor">
                      {plate.title}
                    </Link>
                  </h2>
                  <p className="mt-4 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
                    {plate.intro}
                  </p>
                  <p className="mt-4 max-w-2xl border-l-2 border-sindoor/30 pl-4 font-serif text-[15px] italic leading-relaxed text-deep-ink/80">
                    {plate.howToRead}
                  </p>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <ul className="space-y-1.5 font-sans text-sm">
                    {entries.slice(0, 4).map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={`/learn/${entry.plate}/${entry.slug}`}
                          className="text-muted-ink transition-colors hover:text-sindoor"
                        >
                          {entry.title}
                        </Link>
                      </li>
                    ))}
                    {entries.length > 4 && (
                      <li className="text-muted-ink/60">
                        + {entries.length - 4} more
                      </li>
                    )}
                  </ul>
                  <Link
                    href={`/learn/${plate.id}`}
                    className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.18em] text-sindoor hover:underline"
                  >
                    Open plate {plate.numeral}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <AmbiRule className="mx-auto mt-16 h-6 w-60 text-sindoor/50" />

        {/* ── where to start ─────────────────────────────────────────── */}
        <div className="mt-12 grid gap-8 border-t border-sand-border pt-10 sm:grid-cols-3">
          <div>
            <h3 className="font-serif text-lg text-deep-ink">{t("startWhere")}</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
              {t("startWhereBody")}
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg text-deep-ink">{t("readSlowly")}</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
              {t("readSlowlyBody")}
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg text-deep-ink">{t("keepGoing")}</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
              {t("keepGoingBody", { first: entriesFor("words")[0]?.title ?? "" })}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
