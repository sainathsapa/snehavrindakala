import { Link } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import Image from "next/image";
import { notFound } from "next/navigation";
import { listArtForms, translateArtForms, type ArtForm } from "@/lib/site-content";
import { getArtFormBySlug } from "@/lib/slugs";
import { getTranslations, getLocale } from "next-intl/server";
import { listCatalogueFor } from "@/lib/catalogue";
import { WorkAlertForm } from "@/components/work-alert-form";
import { ProductCard } from "@/components/product-card";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, KalamBorder, MandalaField } from "@/components/ornaments";
import { ButiField, PaperGrain } from "@/components/grounds";
import { medusa } from "@/lib/medusa";
import { soldHandles } from "@/lib/sold-works";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Renders the admin-written long-form story.
 *
 * The body is authored as plain text with `**bold**` spans and blank-line
 * paragraph breaks — deliberately not raw HTML, so an admin cannot inject
 * markup into a public page. Everything is escaped by React.
 */
function StoryBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-6 font-serif text-lg leading-[1.8] text-muted-ink">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {/* The opening paragraph takes a drop cap, the way a printed essay
              in a catalogue does. Everything after it is set plain. */}
          {index === 0 && (
            <span
              className="float-left mr-2 mt-1 font-serif text-[3.2rem] font-semibold leading-[0.78] text-kumkum"
              aria-hidden="true"
            >
              {paragraph.replace(/\*\*/g, "").charAt(0)}
            </span>
          )}
          {index === 0 && (
            <span className="sr-only">{paragraph.replace(/\*\*/g, "").charAt(0)}</span>
          )}
          {(index === 0 ? paragraph.replace(/\*\*/g, "").slice(1) : paragraph)
            .split(/(\*\*[^*]+\*\*)/g)
            .map((chunk, i) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={i} className="font-semibold text-deep-ink">
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              <span key={i}>{chunk}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = (await params) ?? {};
  if (!slug) return { title: "SnehaVrinda Kala" };
  const locale = await getLocale();

  const t = await getTranslations("artForm");
  const forms = await listArtForms(locale).catch(() => []);
  const found = forms.find((f) => f.slug === slug);

  if (!found) return { title: "Art form not found" };
  const form = translateArtForms([found], (k) => t(k as never), (k) =>
    t.has(k as never)
  )[0];

  return {
    title: form.name,
    description: form.description || form.story?.slice(0, 160),
    alternates: localeAlternates(`/art-forms/${form.slug}`),
    openGraph: {
      title: form.name,
      description: form.description,
      images: form.image ? [form.image] : undefined,
    },
  };
}

export default async function ArtFormPage({ params }: PageProps) {
  const { slug } = (await params) ?? {};
  if (!slug) notFound();
  const locale = await getLocale();

  const t = await getTranslations("artForm");
  const tr = (key: string) => t(key as never);
  const has = (key: string) => t.has(key as never);

  const forms = await listArtForms(locale).catch(() => []);
  const stored = forms.find((f) => f.slug === slug);
  // The five individual traditions (madhubani, warli, pattachitra, gond,
  // kalamkari) are part of the taxonomy in lib/slugs.ts and are advertised by
  // the sitemap, the art-forms index and the nav, but they are not rows in
  // site_art_form on a seeded database. Without this fallback every one of
  // those links answered 404 — a broken page reachable from a top-level index.
  // The stored row still wins when the owner writes a story for it in the
  // admin; the taxonomy supplies the name, description and origin until then.
  let raw: ArtForm | undefined = stored;
  if (!raw) {
    const taxonomy = getArtFormBySlug(slug);
    if (!taxonomy) notFound();
    raw = {
      id: -1,
      position: Number.MAX_SAFE_INTEGER,
      slug: taxonomy.slug,
      name: taxonomy.name,
      description: taxonomy.description,
      image: "",
      published: true,
      origin: taxonomy.origin,
    };
  }
  if (!raw) notFound();
  // Translate before anything reads the name, including the catalogue lookup
  // below: matching happens on the stored name, so the English value has to be
  // kept for that even when the page renders the Hindi one.
  const [form] = translateArtForms([raw], tr, has);

  // The works in this tradition. The catalogue resolves aliases internally, but
  // it matches on any of the keys given, so pass the slug *and* the display name
  // (a seeded "Home & Decorative Art" category and the "home-decor" taxonomy
  // entry are the same collection under two spellings).
  const items = await listCatalogueFor([slug, raw.name, raw.slug]).catch(
    () => []
  );
  // Works already sold stay in the record of the tradition, marked as sold.
  const sold = await soldHandles();

  const others = forms.filter((f) => f.slug !== slug).slice(0, 3);

  const baseUrl = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("home"), item: baseUrl },
      { "@type": "ListItem", position: 2, name: t("pageTitle"), item: `${baseUrl}/art-forms` },
      { "@type": "ListItem", position: 3, name: form.name, item: `${baseUrl}/art-forms/${form.slug}` },
    ],
  };

  return (
    <main className="bg-rang-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <PageHeader
        eyebrow={form.origin || "Tradition"}
        title={form.name}
        intro={form.description}
        breadcrumb={[
          { label: t("home"), href: "/" },
          { label: t("pageTitle"), href: "/art-forms" },
          { label: form.name },
        ]}
        image={form.image || undefined}
      />

      {/* ── The story ────────────────────────────────────────────────────── */}
      {form.story && (
        <section className="relative overflow-hidden border-b border-sand-border/60 py-16 lg:py-24">
          <MandalaField className="pointer-events-none absolute -right-24 top-16 hidden h-80 w-80 text-terracotta/[0.05] lg:block" />

          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr] lg:gap-20">
              {/* Marginalia: the facts, set as a museum label would set them. */}
              <aside className="lg:sticky lg:top-28 lg:self-start">
                <BotanicalRule className="text-terracotta" />
                <dl className="mt-8 space-y-6">
                  {form.origin && (
                    <div>
                      <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                        {t("origin")}
                      </dt>
                      <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                        {form.origin}
                      </dd>
                    </div>
                  )}
                  {form.materials && (
                    <div>
                      <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                        {t("materials")}
                      </dt>
                      <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                        {form.materials}                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                      {t("worksAvailable")}
                    </dt>
                    <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                      {items.length > 0
                        ? t("goodsCount", { count: items.length })
                        : t("noneJustNow")}
                    </dd>
                  </div>
                </dl>

                {items.length > 0 && (
                  <Link
                    href={`/shop/${form.slug}`}
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                  >
                    {t("seeWorks")}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </aside>

              <div className="max-w-2xl">
                {form.quote && (
                  <blockquote className="mb-10 border-l-2 border-terracotta/50 pl-6">
                    <p className="font-serif text-xl italic leading-relaxed text-deep-ink sm:text-2xl">
                      {form.quote}
                    </p>
                  </blockquote>
                )}
                <StoryBody text={form.story} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Works in this tradition ──────────────────────────────────────── */}
      {items.length > 0 && (
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-sand-border/60 pb-5">
              <h2 className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
                {t("worksInTradition")}
              </h2>
              <Link
                href={`/shop/${form.slug}`}
                className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
              >
                {t("viewAll")} →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {items.slice(0, 4).map((item) => (
                <ProductCard
                  key={item.handle}
                  handle={item.handle}
                  sold={sold.has(item.handle)}
                  title={item.title}
                  artist={item.artist}
                  price={item.price}
                  currency={item.currency}
                  stockType={item.stockType}
                  image={item.image}
                  isNew={item.isNew}
                  medium={item.specs?.medium}
                  dimensions={item.specs?.dimensions}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Other traditions ─────────────────────────────────────────────── */}
      {others.length > 0 && (
        <section className="relative overflow-hidden bg-[#2A120C] py-16">
          <KalamBorder className="absolute inset-x-0 top-0 text-haldi/30" />
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <h2 className="font-serif text-2xl font-semibold text-rang-paper sm:text-3xl">
              {t("keepLooking")}
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {others.map((other) => (
                <Link key={other.slug} href={`/art-forms/${other.slug}`} className="group">
                  <div className="relative aspect-[4/3] overflow-hidden ring-1 ring-rang-paper/20">
                    {other.image ? (
                      <Image
                        src={other.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-opacity duration-500 group-hover:opacity-80"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#3a1a12]" />
                    )}
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-semibold text-rang-paper transition-colors group-hover:text-haldi">
                    {other.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── The next one ───────────────────────────────────────────────────
          A tradition page is where someone decides they want this kind of
          work. Every piece is one of one, so there is nothing to restock —
          what can be promised is the next piece. This section exists for that
          one sentence, and shows no counts or urgency. */}
      <section className="border-t border-sand-border/60 bg-surface/40">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
          <h2 className="font-serif text-xl font-semibold text-deep-ink">
            {t("alertHeading", { name: form.name })}
          </h2>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-ink">
            {t("alertBody")}
          </p>
          <div className="mt-6">
            <WorkAlertForm artForm={form.slug} artFormName={form.name} />
          </div>
        </div>
      </section>

      {/* ── Continue exploring ─────────────────────────────────────────────
          An exhibition ends with a room map, not a wall. This walks the
          visitor sideways into the rest of the house: the index of traditions,
          the reference material that explains what they just read, and the
          work itself. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/50">
        <ButiField style={{ opacity: 0.35 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="py-10 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-terracotta">
            {t("continueExploring")}
          </p>
          <div className="grid border-t border-sand-border/60 sm:grid-cols-3">
            {[
              {
                href: "/art-forms",
                eyebrow: t("allTraditions"),
                title: t("allTraditionsTitle"),
              },
              {
                href: "/learn",
                eyebrow: t("reference"),
                title: t("referenceTitle"),
              },
              {
                href: `/shop/${form.slug}`,
                eyebrow: t("theWork"),
                title: t("seeForSale", { name: form.name }),
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
                  <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
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
    </main>
  );
}
