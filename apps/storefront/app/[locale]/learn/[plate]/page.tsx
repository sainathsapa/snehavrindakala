import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import {
  PLATES,
  entriesFor,
  languagesFor,
  plateCount,
  type PlateId,
} from "@/lib/learn";
import { PlateBrowser } from "@/components/learn/plate-browser";
import {
  AmbiRule,
  ChakraWatermark,
  PlateSeal,
  PulliGrid,
} from "@/components/learn/motifs";

const PLATE_IDS = PLATES.map((plate) => plate.id);

function asPlate(value: string): PlateId | null {
  return (PLATE_IDS as string[]).includes(value) ? (value as PlateId) : null;
}

// Rendered per request. Prerendering these plates produced a page that threw a
// 500 for Hindi while the English twin was served from the build output.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return PLATE_IDS.map((plate) => ({ plate }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; plate: string }>;
}): Promise<Metadata> {
  const { locale, plate } = await params;
  const id = asPlate(plate);
  if (!id) return {};
  const found = PLATES.find((item) => item.id === id)!;
  return {
    title: `${found.title} — Plate ${found.numeral}`,
    description: found.intro,
    alternates: localeAlternates(`/learn/${id}`, locale),
  };
}

/**
 * A plate: an introduction, then the interactive index.
 *
 * The introduction is deliberately short. A reader who wants the essay reads the
 * entries; a reader who wants a specific word should reach search in one scroll.
 */
export default async function PlatePage({
  params,
}: {
  params: Promise<{ locale: string; plate: string }>;
}) {
  const { locale, plate } = await params;
  const id = asPlate(plate);
  if (!id) notFound();

  const found = PLATES.find((item) => item.id === id)!;
  const entries = entriesFor(id);
  const languages = languagesFor(id);
  const grouped = entries.some((entry) => Boolean(entry.era));
  // The locale comes from the route rather than from the request. A request-
  // scoped lookup only resolves when the middleware has run, which is not true
  // of every render path this page takes.
  const t = await getTranslations({ locale, namespace: "plates" });

  return (
    <main className="bg-rang-paper">
      <section className="relative overflow-hidden border-b border-sand-border">
        <PulliGrid className="pointer-events-none absolute inset-0 h-full w-full text-deep-ink/[0.06]" />
        <ChakraWatermark className="pointer-events-none absolute -left-32 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 text-sindoor/10" />

        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
          <nav className="flex flex-wrap items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-muted-ink">
            <Link href="/learn" className="hover:text-sindoor">
              {t("plateLabel")}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-deep-ink">{found.numeral}</span>
          </nav>

          <div className="mt-8 flex flex-wrap items-start gap-6">
            <PlateSeal
              numeral={found.numeral}
              label={found.id}
              className="h-24 w-24 shrink-0 text-deep-ink/70"
            />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[11px] uppercase tracking-[0.24em] text-sindoor">
                {found.kicker}
              </p>
              <h1 className="mt-2 font-serif text-4xl leading-[1.05] text-deep-ink sm:text-5xl">
                {found.title}
              </h1>
              <p className="mt-4 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
                {found.intro}
              </p>
            </div>
          </div>

          <p className="mt-8 max-w-2xl border-l-2 border-sindoor/30 pl-4 font-serif text-[15px] italic leading-relaxed text-deep-ink/80">
            {found.howToRead}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
            <span>
              {plateCount(id)} {plateCount(id) === 1 ? "entry" : "entries"}
            </span>
            {languages.length > 1 && (
              <>
                <span className="h-3 w-px bg-sand-border" />
                <span>{languages.length} languages</span>
              </>
            )}
            <span className="h-3 w-px bg-sand-border" />
            <span>{t("eachHasPage")}</span>
          </div>
        </div>
      </section>

      {/* The plate's own illustration. It has been part of the plate data since
          the section was built and was never rendered, so the one picture a
          reader most needs — what these things actually look like — was missing
          from the page that describes them. */}
      {found.image ? (
        <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
          <figure className="overflow-hidden">
            <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface">
              <Image
                src={found.image.src}
                alt={found.image.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-deep-ink/10"
              />
            </div>
            <figcaption className="mt-3 font-serif text-[13px] italic text-muted-ink">
              {found.image.alt}
            </figcaption>
          </figure>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <PlateBrowser
          plate={id}
          entries={entries}
          languages={languages}
          grouped={grouped}
        />

        <AmbiRule className="mx-auto mt-16 h-6 w-56 text-sindoor/40" />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-sand-border pt-8 font-sans text-sm">
          <Link href="/learn" className="text-muted-ink hover:text-sindoor">
            ← All plates
          </Link>
          <div className="flex flex-wrap gap-6">
            {PLATES.filter((item) => item.id !== id).map((item) => (
              <Link
                key={item.id}
                href={`/learn/${item.id}`}
                className="text-muted-ink hover:text-sindoor"
              >
                Plate {item.numeral} · {item.title}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
