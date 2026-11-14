import Link from "next/link";
import { localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { PlateNumber, RunningHead, Fleuron, PaintedRule } from "@/components/editorial";
import {
  LotusRosette,
  BelButi,
  MithilaBorder,
  HamsaMotif,
  PeacockEye,
} from "@/components/indian-motifs";
import { GLOSSARY, MATERIALS, TIMELINE } from "@/lib/art-reference";
import { GlossaryExplorer } from "@/components/glossary-explorer";
import { JaaliField, PaperGrain, ButiField } from "@/components/grounds";
import { listArtForms } from "@/lib/site-content";

export const metadata = {
  title: "Learn",
  description:
    "A plain-language guide to Indian art: what the words mean, what the materials are, and how the traditions came to exist.",
  alternates: localeAlternates("/learn"),
};

export const dynamic = "force-dynamic";

/**
 * /learn — the reference section.
 *
 * Every art site sells; very few teach. This page exists so a visitor can find
 * out what *kacni* means or why black pigment is made from lamp soot, without
 * being sold anything and without a wall of prose. It is a glossary, a material
 * index and a short timeline, in that order of usefulness.
 *
 * No products appear on this page at all. That is deliberate: the moment a
 * reference page starts selling, it stops being a reference.
 */
export default async function LearnPage() {
  const t = await getTranslations("learn");
  let forms: { name: string; slug: string; image: string }[] = [];
  try {
    const rows = await listArtForms();
    forms = rows.map((form) => ({
      name: form.name,
      slug: form.slug,
      image: form.image,
    }));
  } catch {
    // A reference page must render even if the content table is empty.
  }

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Reference"
        title="Learn"
        intro="What the words mean, what the work is made of, and where the traditions come from. No shop on this page — only what a visitor needs in order to see."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Learn" }]}
      />

      {/* ── Contents ───────────────────────────────────────────────────────
          A printed reference opens with its own contents. It also makes the
          page scannable, which a glossary of sixteen terms badly needs. */}
      <section className="relative border-b border-sand-border/60">
        <BelButi className="pointer-events-none absolute inset-x-0 top-0 h-4 w-full text-terracotta/20" />
        <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-terracotta">
              {t("contents")}
            </span>
            <a href="#glossary" className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum">
              I. The words
            </a>
            <a href="#materials" className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum">
              II. The materials
            </a>
            <a href="#timeline" className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum">
              III. The history
            </a>
            <a href="#traditions" className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum">
              IV. The traditions
            </a>
          </div>
        </div>
      </section>

      {/* ── I. The glossary ─────────────────────────────────────────────── */}
      <section id="glossary" className="relative scroll-mt-24 overflow-hidden py-16 lg:py-24">
        <JaaliField style={{ opacity: 0.5 }} />
        <PaperGrain />
        <HamsaMotif className="pointer-events-none absolute right-4 top-10 hidden h-24 w-32 text-terracotta/[0.10] lg:block" />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <PlateNumber number={1} label="The words" className="mb-8" />

          <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
            <div>
              <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-deep-ink sm:text-[38px]">
                Words you will
                <br />
                keep meeting
              </h2>
              <p className="mt-5 max-w-xs font-serif text-base leading-relaxed text-muted-ink">
                Sixteen terms, most of them untranslated on shop pages that use
                them constantly. Each is given in its own language, because the
                English word is usually a lossy translation.
              </p>
              <MithilaBorder className="mt-7 h-3 w-32 text-terracotta/30" />
            </div>

            <GlossaryExplorer entries={GLOSSARY} />
          </div>
        </div>
      </section>

      {/* ── II. The materials ───────────────────────────────────────────── */}
      <section
        id="materials"
        className="relative scroll-mt-24 overflow-hidden border-y border-sand-border/60 bg-surface/40 py-16 lg:py-24"
      >
        <PeacockEye className="pointer-events-none absolute -left-2 top-16 hidden h-40 w-28 text-terracotta/[0.10] lg:block" />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <PlateNumber number={2} label="The materials" className="mb-8" />

          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-deep-ink sm:text-[38px]">
              What the work is made of
            </h2>
            <p className="mt-5 font-serif text-lg leading-relaxed text-muted-ink">
              Every material here is chosen for a reason that can be stated. A
              tradition that used rice paste did so because a household already
              had rice — not because rice is picturesque.
            </p>
          </div>

          {/* A reference page that never shows the work is a dictionary. This
              plate breaks the text before the list, and pairs the one thing a
              reader most needs to see — actual pigment on an actual surface —
              with the prose that describes it. */}
          <figure className="mt-12 overflow-hidden">
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-surface">
              <Image
                src="/images/artforms/painting.jpg"
                alt="Detail of a hand-painted work, showing pigment on the surface"
                fill
                sizes="100vw"
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-deep-ink/10"
              />
            </div>
            <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="font-serif text-[13px] italic text-muted-ink">
                Pigment, ground and brushwork: the three decisions every
                tradition makes differently.
              </span>
            </figcaption>
          </figure>

          <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {MATERIALS.map((material) => (
              <li key={material.material} className="border-t border-sand-border/70 pt-5">
                <h3 className="font-serif text-xl font-semibold leading-tight text-deep-ink">
                  {material.material}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {material.what}
                </p>
                <p className="mt-3 border-l-2 border-terracotta/40 pl-3 font-serif text-[15px] italic leading-relaxed text-deep-ink/80">
                  {material.why}
                </p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {material.usedIn.map((tag) => (
                    <span
                      key={tag}
                      className="border border-sand-border/70 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.14em] text-terracotta/80"
                    >
                      {tag}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── III. The timeline ───────────────────────────────────────────── */}
      <section
        id="timeline"
        className="relative scroll-mt-24 overflow-hidden py-16 lg:py-24"
      >
        <ButiField style={{ opacity: 0.35 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <PlateNumber number={3} label="The history" className="mb-8" />

          <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-deep-ink sm:text-[38px]">
                A short
                <br />
                history
              </h2>
              <p className="mt-5 max-w-xs font-serif text-base leading-relaxed text-muted-ink">
                Nine moments, in ranges rather than single years — because the
                dates are argued about, and pretending otherwise would be a lie
                told in the service of tidiness.
              </p>
              <Fleuron className="mt-7 justify-start" />
            </div>

            <ol className="relative border-l border-terracotta/25 pl-6 sm:pl-8">
              {TIMELINE.map((entry, index) => (
                <li key={entry.title} className="relative pb-10 last:pb-0">
                  {/* A dot on the rule, like a marker in a printed timeline. */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-[calc(1.5rem+1px)] top-2 h-2 w-2 rotate-45 bg-terracotta/60 sm:-left-[calc(2rem+1px)]"
                  />
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
                    {entry.era}
                  </span>
                  <h3 className="mt-1.5 font-serif text-xl font-semibold leading-snug text-deep-ink sm:text-2xl">
                    {entry.title}
                  </h3>
                  <p className="mt-2 max-w-xl font-serif text-[15px] leading-relaxed text-muted-ink">
                    {entry.body}
                  </p>
                  {index === TIMELINE.length - 1 && (
                    <PaintedRule className="mt-6 w-40" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── IV. Into the traditions ─────────────────────────────────────── */}
      <section
        id="traditions"
        className="relative scroll-mt-24 border-t border-sand-border/60 py-16 lg:py-24"
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <PlateNumber number={4} label="The traditions" className="mb-8" />
          <RunningHead left="Read the six forms" right="From the reference" />

          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Link key={form.slug} href={`/art-forms/${form.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                  <Image
                    src={form.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                  />
                </div>
                <h3 className="mt-3 border-t border-sand-border/60 pt-3 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                  {form.name}
                </h3>
                <span className="mt-1 inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.16em] text-terracotta">
                  The tradition
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {forms.length === 0 && (
            <div className="mt-10 flex flex-col items-center py-12 text-center">
              <LotusRosette className="h-14 w-14 text-terracotta/30" />
              <p className="mt-4 font-serif text-lg italic text-muted-ink">
                The traditions are being catalogued.
              </p>
            </div>
          )}

          <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-sand-border/60 pt-8">
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta">
              Keep reading
            </span>
            <Link
              href="/journal"
              className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum"
            >
              The journal — essays on technique and history →
            </Link>
            <Link
              href="/art-forms"
              className="font-serif text-[15px] text-deep-ink/80 transition-colors hover:text-kumkum"
            >
              All six traditions →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
