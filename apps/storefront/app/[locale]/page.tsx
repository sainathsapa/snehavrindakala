import { Link } from "@/i18n/routing";
import Image from "next/image";
import {
  ArrowLink,
  SectionIntro,
  BotanicalRule,
  KalamBorder,
  PaisleyField,
  MandalaField,
} from "@/components/ornaments";
import { HeroSlider } from "@/components/hero-slider";
import {
  Reveal,
  ParallaxImage,
  WordRise,
  CurtainPlate,
  ScrollDrift,
} from "@/components/motion";
import {
  KolamMotif,
  WarliMotif,
  LotusBloom,
  DiamondBand,
  JaliPattern,
  KalashMotif,
  BelButi,
  MadhubaniFish,
  HamsaMotif,
  DiyaMotif,
  MithilaBorder,
  LotusRosette,
  PeacockEye,
} from "@/components/indian-motifs";
import {
  PlateNumber,
  PaintedRule,
  Fleuron,
  CornerPeacock,
  ChapterOpener,
} from "@/components/editorial";
import { JaaliField, JaaliScreen, PaperGrain, GoldVineBand } from "@/components/grounds";
import { getTranslations, getLocale } from "next-intl/server";
import { listCatalogue } from "@/lib/catalogue";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { formatPrice } from "@/lib/medusa";
import {
  listHeroSlides,
  listArtForms,
  listFeaturedCategories,
  listTestimonials,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

/** Real Indian art traditions, used for the decorative frieze band. */
const TRADITIONS = [
  "Madhubani",
  "Warli",
  "Pattachitra",
  "Gond",
  "Kalamkari",
  "Phad",
  "Miniature",
  "Bhil",
  "Kerala Mural",
  "Pichwai",
];

export default async function Home() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  // Everything curated lives in Postgres and is edited at /admin/content.
  const [slides, artForms, categories, catalogue, testimonials] =
    await Promise.all([
      listHeroSlides(locale),
      listArtForms(locale),
      listFeaturedCategories(locale),
      listCatalogue().catch(() => []),
      listTestimonials(),
    ]);

  // The Artists directory only exists in platform mode. In single-brand mode
  // SnehaVrinda Kala is the only seller, the /artists listing is a dead end,
  // and the header already hides it — so the homepage must not link to it
  // either.
  const platformMode = getPlatformModeFromEnv() === "platform";

  const featuredProducts = catalogue.slice(0, 4);
  const featuredForms = artForms.slice(0, 5);

  return (
    <main className="bg-rang-paper">
      {/* ── Hero carousel ─────────────────────────────────────────────────
          Slides are admin-managed and genuinely cycle: auto-advance, arrows,
          dots, swipe and keyboard, pausing on hover and focus. */}
      <div className="relative">
        <HeroSlider slides={slides} interval={2000} />
        <KalamBorder className="pointer-events-none absolute inset-x-0 top-0 text-terracotta/40" />
      </div>

      {/* ── Statement strip ─────────────────────────────────────────────────
          A short editorial line between the hero and the first row, with the
          botanical mark that recurs through the references. */}
      <section className="relative overflow-hidden border-y border-sand-border/60 bg-surface/60 py-10">
        <DiamondBand className="absolute inset-x-0 top-0 h-2.5 w-full text-terracotta/25" />
        <PaisleyField className="pointer-events-none absolute -left-10 top-0 hidden h-40 w-40 text-terracotta/[0.08] md:block" />
        <div className="relative mx-auto flex max-w-[1400px] items-center gap-6 px-5 sm:px-8 lg:px-12">
          <BotanicalRule className="hidden shrink-0 text-terracotta sm:flex" />
          <p className="font-serif text-lg leading-relaxed text-deep-ink sm:text-xl">
            {t("lede")}
          </p>
        </div>
      </section>

      {/* ── Art-form marquee ────────────────────────────────────────────────
          A slow band of tradition names, like a painted frieze running across
          the page. Purely decorative; it pauses entirely for reduced-motion
          users and is hidden from assistive tech. */}
      <div
        className="overflow-hidden border-b border-sand-border/60 bg-rang-paper py-4"
        aria-hidden="true"
      >
        <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap">
          {[...TRADITIONS, ...TRADITIONS].map((name, i) => (
            <span key={`${name}-${i}`} className="flex items-center gap-8">
              <span className="font-serif text-sm uppercase tracking-[0.3em] text-muted-ink/70">
                {name}
              </span>
              <span className="text-terracotta/50">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Manifesto ──────────────────────────────────────────────────────
          The single most "alive" band on the page: a full-bleed work, a large
          serif declaration set against it, and a slow parallax drift so the
          image behaves like a window rather than a picture. This is the section
          that makes the site read as an artist's site and not a catalogue. */}
      <section className="relative overflow-hidden bg-[#2A120C]">
        <div className="absolute inset-0">
          <ParallaxImage
            src="/images/products/madhubani-painting.jpg"
            alt=""
            className="h-full w-full opacity-45"
            strength={30}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A120C] via-[#2A120C]/70 to-[#2A120C]/40" />
        <KalamBorder className="absolute inset-x-0 top-0 text-haldi/25" />
        {/* A hamsa at the head of the declaration, as a manuscript page opens
            with a swan. Set low so it reads as a watermark, not an icon. */}
        <HamsaMotif className="pointer-events-none absolute right-6 top-16 hidden h-28 w-40 text-haldi/[0.13] lg:block" />
        <PeacockEye className="pointer-events-none absolute -left-2 bottom-0 hidden h-44 w-32 text-haldi/[0.09] lg:block" />

        <div className="relative mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
          <Reveal className="max-w-3xl">
            <div className="flex items-center gap-4">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-haldi/70">
                Plate 01
              </span>
              <span className="h-px w-8 bg-haldi/30" aria-hidden="true" />
              <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-rang-paper/40">
                {t("onTheHand")}
              </span>
            </div>
            {/* The words rise into place one at a time, the way a line of
                type is set — language arriving rather than a block fading in. */}
            <WordRise
              as="p"
              className="mt-6 font-serif text-[28px] font-medium leading-[1.35] text-rang-paper sm:text-[40px] lg:text-[48px]"
              text={t("machineCan")}
            />
            <p className="mt-3 font-serif text-[28px] font-medium leading-[1.35] text-rang-paper/55 sm:text-[40px] lg:text-[48px]">
              {t("machineCannot")}
            </p>
            <p className="mt-8 max-w-xl font-sans text-base leading-[1.8] text-rang-paper/70">
              {t("craftNote")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/art-forms"
                className="inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
              >
                {t("learnTraditions")}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-full border border-rang-paper/40 px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:border-haldi hover:text-haldi"
              >
                {t("readStory")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The threshold ──────────────────────────────────────────────────
          A kolam drawn across the page the way it is drawn across a doorway in
          Tamil Nadu each morning: rice flour, a dot grid, one continuous line.
          It marks the passage from the introduction into the collection. */}
      <section
        className="relative flex flex-col items-center gap-4 border-b border-sand-border/60 py-12"
        aria-hidden="true"
      >
        {/* A pair of Mithila fish either side of the kolam — the threshold mark
            from Mithila, paired with the one from Tamil Nadu. */}
        <div className="group flex items-center gap-8 sm:gap-14">
          <MadhubaniFish className="h-10 w-20 -scale-x-100 text-terracotta/30 transition-all duration-700 group-hover:-translate-x-1 group-hover:text-terracotta/60" />
          {/* The kolam is drawn on as it scrolls into view — one continuous
              line, the way it is actually drawn. */}
          <KolamMotif className="kolam-draw h-24 w-24 text-terracotta/40 transition-colors duration-700 group-hover:text-terracotta/70" />
          <MadhubaniFish className="h-10 w-20 text-terracotta/30 transition-all duration-700 group-hover:translate-x-1 group-hover:text-terracotta/60" />
        </div>
        <span className="h-px w-24 bg-sand-border" aria-hidden="true" />
        <p className="max-w-md px-6 text-center font-serif text-sm italic leading-relaxed text-muted-ink">
          {t("kolam")}
        </p>
      </section>

      {/* ── Choose your way in ──────────────────────────────────────────────
          A brief asks Discover to answer "where do I begin?" with several
          routes rather than one grid. The composition is deliberately uneven —
          one wide panel that leads with a photograph, then a stack of narrower
          ones that lead with type — because six identical cards would just be
          the same grid under a different heading. Each route is a real page:
          nothing here is a teaser that dead-ends. */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-16 lg:py-24">
        <JaaliScreen opacity={0.14} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <ChapterOpener
            eyebrow={t("browse")}
            title={t("findSomething")}
            standfirst={t("findBody")}
            className="mb-12 lg:mb-16"
          />

          <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
            {/* The lead route: wide, image-first. */}
            <Link
              href="/art-forms"
              className="group relative col-span-1 flex min-h-[280px] flex-col justify-end overflow-hidden bg-[#2A120C] p-7 lg:col-span-7 lg:min-h-[380px] lg:p-9"
            >
              {featuredForms[0]?.image && (
                <img
                  src={featuredForms[0].image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05] group-hover:opacity-75"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#2A120C] via-[#2A120C]/55 to-transparent"
              />
              <div className="relative">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-haldi">
                  {t("artForms")}
                </p>
                <h3 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] text-rang-paper sm:text-[42px]">
                  {t("shopByArtForm")}
                </h3>
                <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-rang-paper/75">
                  {t("artFormsIntro")}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-haldi">
                  {t("browse")}
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </Link>

            {/* The narrower routes: type-first, stacked. */}
            <div className="col-span-1 grid gap-5 lg:col-span-5 lg:gap-6">
              {[
                {
                  href: "/learn",
                  eyebrow: t("routes.learn.eyebrow"),
                  title: t("routes.learn.title"),
                  copy: t("routes.learn.copy"),
                },
                {
                  href: "/shop",
                  eyebrow: t("routes.shop.eyebrow"),
                  title: t("routes.shop.title"),
                  copy: t("routes.shop.copy"),
                },
                {
                  href: "/journal",
                  eyebrow: t("routes.journal.eyebrow"),
                  title: t("routes.journal.title"),
                  copy: t("routes.journal.copy"),
                },
              ].map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="group flex flex-col justify-center border border-sand-border/70 bg-surface/70 p-6 transition-colors hover:border-terracotta/40 hover:bg-surface lg:p-7"
                >
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta">
                    {route.eyebrow}
                  </p>
                  <h3 className="mt-2 font-serif text-xl font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum sm:text-2xl">
                    {route.title}
                  </h3>
                  <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                    {route.copy}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Indian Art Forms ─────────────────────────────────────────────── */}
      <section className="relative border-b border-sand-border/60 py-14 lg:py-20">
        <PaisleyField className="pointer-events-none absolute right-0 top-10 hidden h-64 w-64 text-terracotta/[0.07] lg:block" />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
            <SectionIntro
              eyebrow={t("artForms")}
              title={t("artFormsTitle")}
              description={t("indianArtBody")}
            />

            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {featuredForms.map((form, index) => (
                  <Reveal key={form.slug} as="div" delay={index * 70}>
                  <Link
                    href={`/art-forms/${form.slug}`}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                      <Image
                        src={form.image}
                        alt={form.name}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
                        className="object-cover transition-[transform,filter] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-hover:brightness-105"
                      />
                      {/* A wash of ink rises from the foot of the plate, and
                          the tradition's name is repeated over it — the way a
                          museum label sits on the mount, not beside it. */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 translate-y-full bg-gradient-to-t from-[#2A120C]/85 via-[#2A120C]/35 to-transparent transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-3 font-serif text-lg font-semibold leading-tight text-rang-paper opacity-0 transition-all duration-500 delay-100 group-hover:translate-y-0 group-hover:opacity-100"
                      >
                        {form.name}
                      </span>
                    </div>
                    <div className="mt-2.5 border-t border-sand-border/50 pt-2">
                      <h3 className="font-serif text-base font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
                        {form.name}
                      </h3>
                      <span className="mt-0.5 inline-flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.14em] text-terracotta">
                        The story
                        <span
                          className="transition-transform duration-300 group-hover:translate-x-1"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                  </Reveal>
                ))}
              </div>
              <ArrowLink href="/art-forms" className="mt-8">
                {t("exploreAllForms")}
              </ArrowLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Craft journey banner ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2A120C]">
        <Image
          src="/images/products/madhubani-painting.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover opacity-40 lg:w-1/2 lg:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2A120C]/80 to-[#2A120C] lg:via-[#2A120C]/70" />
        <MandalaField className="pointer-events-none absolute -right-16 top-1/2 hidden h-80 w-80 -translate-y-1/2 text-haldi/15 md:block" />

        <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
          <div />
          <div className="max-w-lg">
            <SectionIntro
              eyebrow="The Craft Journey"
              tone="light"
              title="Behind the Masterpiece"
              description="Step into the artist's world and discover the stories, skills and traditions behind each artwork."
            />
            {/* Same rule as the artist band: the directory is platform-only. */}
            <ArrowLink
              href={platformMode ? "/artists" : "/art-forms"}
              tone="light"
              className="mt-6"
            >
              {platformMode ? "Explore the Journey" : "Explore the traditions"}
            </ArrowLink>
          </div>
        </div>
      </section>

      {/* ── Selected works ─────────────────────────────────────────────────
          Presented as a gallery wall rather than a product row: one work leads,
          the rest sit beside it as plates, and the captions read like labels. */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-sand-border/60 pb-6">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
                {t("selectedWorks")}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-deep-ink sm:text-[42px]">
                {t("fromStudio")}
              </h2>
            </div>
            <ArrowLink href="/shop">{t("seeFullCollection")}</ArrowLink>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-12 lg:grid-cols-[1.4fr_1fr_1fr]">
            {featuredProducts.map((product, index) => (
              <Link
                key={product.handle}
                href={`/products/${product.handle}`}
                className={`group ${index === 0 ? "lg:row-span-2" : ""}`}
              >
                <div
                  className={`relative overflow-hidden bg-surface ring-1 ring-sand-border/50 ${
                    index === 0 ? "aspect-[4/5]" : "aspect-[4/3]"
                  }`}
                >
                  <Image
                    src={product.image}
                    alt={`${product.title} by ${product.artist}`}
                    fill
                    sizes={
                      index === 0
                        ? "(max-width: 1024px) 100vw, 45vw"
                        : "(max-width: 1024px) 50vw, 27vw"
                    }
                    className="object-cover transition-opacity duration-500 group-hover:opacity-90"
                  />
                </div>
                <div className="mt-4 border-t border-sand-border/60 pt-3">
                  {/* Plate number turns the row into a catalogue page rather
                      than a product grid. */}
                  <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta/70 tabular-nums">
                    Plate {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={`font-serif font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum ${
                      index === 0 ? "text-2xl" : "text-lg"
                    }`}
                  >
                    {product.title}
                  </h3>
                  <p className="mt-1 font-sans text-xs italic text-muted-ink">
                    {product.artist}
                  </p>
                  <p className="mt-2 font-sans text-xs text-deep-ink">
                    {formatPrice(product.price, product.currency.toUpperCase())}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Artist in focus ────────────────────────────────────────────────
          An artist site introduces the person before it sells the object. This
          band gives one maker a portrait, a quote and a way into their work. */}
      <section className="relative overflow-hidden border-y border-sand-border/60 bg-surface/50 py-16 lg:py-24">
        <MandalaField className="pointer-events-none absolute -left-20 top-1/2 hidden h-80 w-80 -translate-y-1/2 text-terracotta/[0.06] lg:block" />
        <div className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12">
          {/* The portrait is uncovered by a blind lifting off it, so the work
              arrives on the wall rather than simply fading in. */}
          <CurtainPlate className="aspect-[4/5] w-full bg-rang-paper ring-1 ring-sand-border/60 lg:aspect-square">
            <Image
              src="/images/artforms/folk.jpg"
              alt="Madhubani work in progress"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </CurtainPlate>

          <div className="max-w-xl">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              {t("artistInFocus")}
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug text-deep-ink sm:text-3xl">
              &ldquo;My grandmother never signed her work. I sign mine, and I
              write down what she taught me.&rdquo;
            </h2>
            <p className="mt-5 font-sans text-small leading-relaxed text-muted-ink">
              {t("artistBody")}{" "}
              panel can take a fortnight, and the border you think is decoration
              is often a genealogy — the fish for fertility, the bamboo for
              endurance, the parrot for the messenger.
            </p>
            <p className="mt-4 font-sans text-small leading-relaxed text-muted-ink">
              {t("artistBody2")}{" "}
              it on. Every work on this site names the hand that made it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {platformMode ? (
                <Link
                  href="/artists"
                  className="inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                >
                  {t("meetArtists")}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                // In single-brand mode there is no directory to send anyone to,
                // so the primary action leads to the traditions instead.
                <Link
                  href="/art-forms"
                  className="inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                >
                  {t("exploreTraditions")}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
              <Link
                href="/custom-art"
                className="inline-flex items-center gap-2 rounded-full border border-sand-border px-6 py-3 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum"
              >
                {t("requestPiece")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured categories ─────────────────────────────────────────────
          Admin-curated shortcuts into the collections, shown as wide artwork
          bands rather than plain links. */}
      {categories.length > 0 && (
        <section className="border-y border-sand-border/60 bg-surface/40 py-14 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <SectionIntro
              eyebrow="Collections"
              title="Browse by collection"
              align="center"
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={category.href}
                  className="group relative block overflow-hidden rounded-sm"
                >
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={category.image || "/images/artforms/painting.jpg"}
                      alt={category.label}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2A120C]/85 via-[#2A120C]/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="font-serif text-lg font-semibold text-rang-paper">
                      {category.label}
                    </h3>
                    <span className="mt-1 inline-flex items-center gap-1 font-sans text-xs text-rang-paper/80">
                      Explore
                      <span
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Custom art panel ───────────────────────────────────────────────
          This used to be a second full-width coloured banner, directly above
          another full-width photographic one. Two identical slabs in a row is
          exactly the repeated-UI pattern to avoid, so the commission is set
          differently: a split spread with the ornament carried in a framed
          panel rather than behind type. The commission is a conversation, so
          it reads as an invitation with a footnote, not a billboard. */}
      {/* A painted frieze closing the browse section.

          This is the one place on the homepage where ornament is allowed to be
          the subject rather than the ground: a real gold-on-burgundy vine band
          at full height, reading as the carved lintel above a doorway. */}
      <GoldVineBand className="border-y border-deep-ink/10" height={72} />

      <section className="relative overflow-hidden py-16 lg:py-24">
        <JaaliField style={{ opacity: 0.22 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div className="relative overflow-hidden bg-kumkum px-7 py-11 sm:px-11 lg:px-14 lg:py-14">
              <MandalaField className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 text-haldi/20 lg:h-64 lg:w-64" />
              <div className="relative">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-haldi">
                  Commission
                </p>
                <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-rang-paper sm:text-[40px]">
                  {t("customTitle")}
                </h2>
                <p className="mt-3 max-w-md font-sans text-small leading-relaxed text-rang-paper/80">
                  {t("customBody")}{" "}
                  paintings, décor and event artwork made to order.
                </p>
                <Link
                  href="/custom-art"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
                >
                  {t("letsCreate")}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* The steps, as a numbered margin note rather than another card. */}
            <ol className="space-y-5">
              {[
                ["Share the idea", "A sentence is enough to begin. A reference helps."],
                ["Talk it through", "We answer with feasibility, timing and a real quote."],
                ["Watch it made", "Proofs at each stage, and you approve before dispatch."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4 border-b border-sand-border/60 pb-5 last:border-0">
                  <span className="font-serif text-2xl font-semibold text-terracotta/50 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-deep-ink">{title}</h3>
                    <p className="mt-1 font-sans text-[13px] leading-relaxed text-muted-ink">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── The Art of India ─────────────────────────────────────────────── */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-lg">
            <div className="relative h-[300px] w-full sm:h-[340px]">
              <Image
                src="/images/artforms/textile.jpg"
                alt=""
                aria-hidden="true"
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#2A120C]/90 via-[#2A120C]/60 to-transparent" />
            <KalamBorder className="absolute inset-x-0 bottom-0 text-haldi/40" />
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-md px-6 sm:px-12">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-haldi">
                  Our Story
                </p>
                <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-rang-paper sm:text-4xl">
                  {t("artOfIndia")}
                </h2>
                <p className="mt-3 font-sans text-small leading-relaxed text-rang-paper/80">
                  {t("artOfIndiaBody")}{" "}
                  reason. We work directly with artists across India so the
                  story travels with the piece.
                </p>
                <Link
                  href="/about"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
                >
                  {t("knowMore")}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How a work is made ─────────────────────────────────────────────
          The process, told with the Warli figure beside it. Warli is the right
          register for this: it is a drawing system built from triangles and
          circles, used by a community that paints the everyday — planting,
          dancing, carrying water. It reads as "made by people" instantly. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/40 py-16 lg:py-24">
        <JaliPattern className="pointer-events-none absolute inset-0 text-terracotta/[0.05]" />
        <DiamondBand className="absolute inset-x-0 top-0 h-2.5 w-full text-terracotta/25" />

        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <WarliMotif className="h-32 w-32 text-terracotta/50" />
              <p className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
                The process
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-deep-ink sm:text-4xl">
                {t("processTitle")}
              </h2>
              <p className="mt-4 font-sans text-sm leading-relaxed text-muted-ink">
                {t("processBody")}{" "}
                weeks it actually takes.
              </p>
            </div>

            <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {[
                {
                  n: "01",
                  title: "Share your brief",
                  body: "The idea, the medium, the size, the budget and the date you need it by. Reference images help but a sentence is enough to start.",
                },
                {
                  n: "02",
                  title: "An artist answers",
                  body: "Someone who actually works in that tradition reads it and says honestly whether it is possible, and what it would cost.",
                },
                {
                  n: "03",
                  title: "A versioned quote",
                  body: "Scope, deliverables, timeline, revision allowance and deposit, in writing — before anything is committed.",
                },
                {
                  n: "04",
                  title: "Proofs, then the work",
                  body: "You see it in progress and request in-scope changes. Then it is finished, packed and tracked to your door.",
                },
              ].map((step) => (
                <li key={step.n} className="border-t border-terracotta/40 pt-5">
                  <span className="font-serif text-sm font-semibold tracking-[0.16em] text-terracotta">
                    {step.n}
                  </span>
                  <h3 className="mt-2 font-serif text-xl font-semibold text-deep-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Closing threshold ────────────────────────────────────────────────
          The kalash again, mirrored from the footer, to close the page the way
          an Indian ceremony closes: with the same auspicious form it opened
          with. */}
      <section className="relative overflow-hidden py-16 text-center">
        {/* A lotus floating on water, with diyas either side — the closing
            gesture of a rangoli being finished. */}
        <div className="flex items-center justify-center gap-6">
          <DiyaMotif className="h-7 w-7 text-terracotta/40" />
          <LotusBloom className="h-16 w-28 text-terracotta/45" />
          <DiyaMotif className="h-7 w-7 text-terracotta/40" />
        </div>
        <p className="mx-auto mt-6 max-w-md px-6 font-serif text-xl italic leading-relaxed text-deep-ink">
          {t("closingLede")}
        </p>
        <Fleuron className="mt-8" />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
          >
            {t("browseCollection")}
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/custom-art"
            className="inline-flex items-center gap-2 rounded-full border border-sand-border px-6 py-3 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum"
          >
            {t("requestPiece")}
          </Link>
        </div>
      </section>

      {/* ── Continue the journey ─────────────────────────────────────────────
          A brief is firm that a page must not end at a call to action. Buying is
          one way to leave; understanding is another, and it is the one that
          brings people back. These three doors take the visitor sideways into
          the rest of the house instead of out of it. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/50">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="py-10 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-terracotta">
            {t("continueJourney")}
          </p>
          <div className="grid border-t border-sand-border/60 sm:grid-cols-3">
            {[
              {
                href: "/art-forms",
                eyebrow: "The traditions",
                title: "Every art form has a language",
              },
              {
                href: "/learn",
                eyebrow: "The reference",
                title: "What the words and materials mean",
              },
              {
                href: "/about",
                eyebrow: "The studio",
                title: "Who makes this, and why",
              },
            ].map((door, i) => (
              <Link
                key={door.href}
                href={door.href}
                className={`group flex flex-col justify-between gap-8 px-1 py-9 transition-colors hover:bg-surface sm:px-7 ${
                  i > 0 ? "border-t border-sand-border/60 sm:border-l sm:border-t-0" : ""
                }`}
              >
                <div>
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-ink/70">
                    {door.eyebrow}
                  </p>
                  <h3 className="mt-2 font-serif text-xl font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                    {door.title}
                  </h3>
                </div>
                <span
                  aria-hidden="true"
                  className="text-lg text-terracotta transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Buyer words ────────────────────────────────────────────────────
          Placed after the browse sections and before the closing doors: by
          this point someone has seen the work and is deciding whether to trust
          it. Two or three real quotes do more than a badge row. Renders only
          when the admin has published something, so an empty table leaves no
          hollow band. */}
      {testimonials.length > 0 && (
        <section className="relative overflow-hidden border-t border-sand-border/60 py-14 lg:py-20">
          <PaperGrain />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <SectionIntro
              eyebrow="In their words"
              title="The work, once it is home"
              align="center"
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.slice(0, 3).map((t) => (
                <figure
                  key={t.id}
                  className="border-t border-sand-border/70 pt-5"
                >
                  <blockquote className="font-serif text-lg leading-relaxed text-deep-ink">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-3 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink">
                    {t.author}
                    {t.location ? ` · ${t.location}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <ArrowLink href="/authenticity">
                {t("howWeStand")}
              </ArrowLink>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
