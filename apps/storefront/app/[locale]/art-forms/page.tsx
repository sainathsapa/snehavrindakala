import Link from "next/link";
import Image from "next/image";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";
import { listArtForms, translateArtForms } from "@/lib/site-content";
import { getTranslations, getLocale } from "next-intl/server";
import { SectionIntro, MandalaField, KalamBorder } from "@/components/ornaments";
import { ChapterOpener } from "@/components/editorial";
import { Reveal } from "@/components/motion";
import { JaaliField, PaperGrain } from "@/components/grounds";

export const dynamic = "force-dynamic";

interface ArtFormCard {
  key: string;
  name: string;
  description: string;
  href: string;
  /** The editorial page explaining the tradition. */ 
  storyHref: string;
  image: string | null;
}

/**
 * Art-form artwork is named after the short taxonomy slug (painting.svg,
 * folk.svg...). Categories seeded in the catalogue use their own handles, so
 * alias the ones we know about rather than showing a blank tile.
 */
const ART_FORM_IMAGES = new Set(
  artFormSlugs.map((form) => form.slug as string)
);

const IMAGE_ALIASES: Record<string, string> = {
  "folk-art": "folk",
};

function imageFor(slug: string): string | null {
  const resolved = IMAGE_ALIASES[slug] ?? slug;
  return ART_FORM_IMAGES.has(resolved) ? `/images/artforms/${resolved}.jpg` : null;
}

export default async function ArtFormsPage() {
  const locale = await getLocale();
  // Art-form names and descriptions live in Postgres, so they need translating
  // at read time; otherwise a Hindi visitor reads a Hindi grid under English
  // section headings.
  const t = await getTranslations("artForm");
  const tr = (key: string) => t(key as never);
  const has = (key: string) => t.has(key as never);
  let catalogue: ArtFormCard[] = [];

  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    catalogue = (product_categories || []).map((category: any) => ({
      key: category.id,
      name: category.name,
      description:
        category.description ||
        "Browse handmade works from Indian makers in this collection.",
      href: `/shop/${category.handle}`,
      storyHref: `/art-forms/${IMAGE_ALIASES[category.handle] ?? category.handle}`,
      image: imageFor(category.handle),
    }));
  } catch (err) {
    console.error("Failed to load product categories from Medusa", err);
  }

  // Admin-managed art forms take priority: they are the curated list the shop
  // owner edits at /admin/content, so they define what this page shows.
  let managed: ArtFormCard[] = [];
  try {
    managed = translateArtForms(
      await listArtForms(locale),
      tr,
      has
    ).map((form) => ({
      key: `managed-${form.id}`,
      name: form.name,
      description: form.description,
      href: `/shop/${form.slug}`,
      storyHref: `/art-forms/${form.slug}`,
      image: form.image || null,
    }));
  } catch {
    // Fall through to the catalogue/taxonomy paths below.
  }
  if (managed.length > 0) {
    catalogue = managed;
  }

  // Merge in the site-wide art-form taxonomy. The catalogue currently holds
  // only a couple of categories, and this page previously swapped wholesale
  // between "live categories" and "the full list" — so as soon as one category
  // was seeded, the other art forms silently vanished from the page. Showing
  // the union keeps the taxonomy complete and lets seeded categories win where
  // they overlap.
  //
  // Overlap is compared on the *resolved* art-form key, not the raw handle: a
  // seeded "folk-art" category and the taxonomy's "folk" entry are the same art
  // form, and comparing handles alone listed it twice.
  const keyFor = (slugOrName: string) => {
    const aliased = IMAGE_ALIASES[slugOrName] ?? slugOrName;
    return aliased.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const shown = new Set(catalogue.map((card) => keyFor(card.href.replace("/shop/", ""))));
  for (const card of catalogue) {
    shown.add(keyFor(card.name));
  }

  for (const form of artFormSlugs) {
    if (shown.has(keyFor(form.slug)) || shown.has(keyFor(form.name))) continue;
    catalogue.push({
      key: form.slug,
      name: has(`names.${form.slug}`) ? tr(`names.${form.slug}`) : form.name,
      description: has(`descriptions.${form.slug}`)
        ? tr(`descriptions.${form.slug}`)
        : form.description,
      href: `/shop/${form.slug}`,
      storyHref: `/art-forms/${form.slug}`,
      image: imageFor(form.slug),
    });
  }

  // The sequence needs one tradition to open the exhibition and the rest to
  // follow it. A catalogue with no headings is just a list; the first card
  // gets the full spread, everything else alternates beneath it.
  const featured = catalogue[0];
  const rest = catalogue.slice(1);

  return (
    <main className="bg-rang-paper">
      {/* ── Hero band ──────────────────────────────────────────────────────
          A shallow artwork banner with the title set over its darkened left,
          as in the reference category page. */}
      <section className="relative min-h-[240px] overflow-hidden lg:min-h-[300px]">
        <Image
          src="/images/hero/hero-art.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2A120C]/95 via-[#2A120C]/75 to-[#2A120C]/25" />
        <MandalaField className="pointer-events-none absolute -right-12 top-1/2 hidden h-72 w-72 -translate-y-1/2 text-haldi/20 md:block" />
        <KalamBorder className="absolute inset-x-0 bottom-0 text-haldi/35" />

        <div className="relative mx-auto flex min-h-[240px] max-w-[1400px] flex-col justify-center px-5 py-12 sm:px-8 lg:min-h-[300px] lg:px-12">
          <h1 className="font-serif text-[40px] font-semibold leading-tight tracking-tight text-rang-paper sm:text-[52px]">
            {t("pageTitle")}
          </h1>
          <p className="mt-2 font-sans text-small text-rang-paper/75">
            {t("pageTagline")}
          </p>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1400px] px-5 pt-5 sm:px-8 lg:px-12">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 font-sans text-xs text-muted-ink"
        >
          <Link href="/" className="hover:text-kumkum transition-colors">
            Home
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-deep-ink">Art Forms</span>
        </nav>
      </div>

      {/* ── The traditions, as an exhibition ───────────────────────────────
          This was a sidebar plus a three-across card grid — the exact pattern
          to avoid, and the reason the page read as a category listing rather
          than a collection of living traditions.

          It is now a sequence with a rhythm: one featured tradition given a
          full spread, then the rest as alternating image/type compositions,
          and a close that leads somewhere. The data is the same list the shop
          sells from; only the composition changed. */}
      <section className="relative overflow-hidden py-14 lg:py-20">
        <JaaliField style={{ opacity: 0.35 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <ChapterOpener
            chapter="I"
            eyebrow={t("pageEyebrow")}
            title={t("pageTitle")}
            standfirst={t("pageIntro")}
            className="mb-14 lg:mb-20"
          />

          {/* The featured tradition, given the full width it deserves. */}
          {featured && (
            <Link
              href={featured.storyHref}
              className="group grid items-stretch overflow-hidden border border-sand-border/70 bg-surface/60 lg:grid-cols-2"
            >
              <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[440px]">
                {featured.image && (
                  <Image
                    src={featured.image}
                    alt={featured.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                )}
              </div>
              <div className="flex flex-col justify-center px-7 py-10 sm:px-12 lg:px-14 lg:py-14">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                  {t("featured")}
                </p>
                <h2 className="mt-3 font-serif text-[34px] font-semibold leading-[1.05] tracking-tight text-deep-ink transition-colors group-hover:text-kumkum sm:text-[46px]">
                  {featured.name}
                </h2>
                <p className="mt-4 max-w-lg font-serif text-lg italic leading-relaxed text-muted-ink">
                  {featured.description}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">
                  {t("enterExhibition")}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>
            </Link>
          )}

          {/* The rest, alternating: a catalogue does not put every work in the
              same frame. */}
          <div className="mt-16 space-y-16 lg:mt-24 lg:space-y-24">
            {rest.map((form, index) => (
              <Reveal key={form.key} as="article" delay={60}>
                <Link
                  href={form.storyHref}
                  className={`group grid items-center gap-8 lg:grid-cols-12 lg:gap-12 ${
                    index % 2 === 1 ? "lg:[&>figure]:order-2" : ""
                  }`}
                >
                  <figure
                    className={`relative overflow-hidden bg-surface lg:col-span-7 ${
                      index % 3 === 0 ? "aspect-[16/10]" : "aspect-[4/3]"
                    }`}
                  >
                    {form.image && (
                      <Image
                        src={form.image}
                        alt={form.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 58vw"
                        className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                      />
                    )}
                  </figure>

                  <div className="lg:col-span-5">
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-terracotta/80 tabular-nums">
                      Plate {String(index + 2).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 font-serif text-[26px] font-semibold leading-tight tracking-tight text-deep-ink transition-colors group-hover:text-kumkum sm:text-[32px]">
                      {form.name}
                    </h2>
                    <p className="mt-3 font-sans text-sm leading-relaxed text-muted-ink">
                      {form.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 border-b border-terracotta/40 pb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta transition-colors group-hover:border-kumkum group-hover:text-kumkum">
                      {t("readStory")}
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* A close that leads on, rather than stopping. */}
          <div className="mt-16 border-t border-sand-border/60 pt-10 text-center lg:mt-24">
            <p className="mx-auto max-w-xl font-serif text-xl italic leading-relaxed text-deep-ink">
              {t("traditionLede")}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                {t("seeWork")}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 rounded-full border border-sand-border px-6 py-3 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum"
              >
                {t("understandCraft")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
