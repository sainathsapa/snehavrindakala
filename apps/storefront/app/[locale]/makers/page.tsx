import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { ProductCard } from "@/components/product-card";
import { listCatalogue } from "@/lib/catalogue";
import { soldHandles } from "@/lib/sold-works";
import { listArtists } from "@/lib/site-content";
import { slugify } from "@/lib/slugs";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { notFound } from "next/navigation";

/**
 * The Makers page — what a single-brand art house shows where a marketplace
 * would show an artist directory.
 *
 * `/artists` is a marketplace feature and 404s in single-brand mode by design.
 * That left the house's most important claim — that a named person made each
 * work — with nowhere to be seen in full. This page is that place, and it
 * deliberately does not depend on the artist module: it derives makers from the
 * catalogue itself, so it works in either platform mode.
 *
 * Nothing here is authored. Names, work counts and links come from published
 * product records. No biography, provenance or portrait is invented: if the
 * catalogue has no maker, the page shows an honest empty state rather than
 * placeholder copy about someone who does not exist.
 *
 * In platform mode `/artists` is the richer destination, so this page steps
 * aside and redirects there rather than competing with it.
 */
export const metadata = {
  title: "The makers",
  description:
    "The artists and craftspeople whose work is available through SnehaVrinda Kala. Every published work names the hand that made it.",
  alternates: localeAlternates("/makers"),
};

// Derived from the catalogue, which reads the currency cookie for pricing — so
// this page must stay per-request. Making it static would freeze prices at
// whatever currency happened to be used at build time.
export const dynamic = "force-dynamic";

export default async function MakersPage() {
  // A marketplace already has /artists; two overlapping directories would be
  // the duplication this site is trying to avoid.
  if (getPlatformModeFromEnv() === "platform") notFound();

  const t = await getTranslations("makers");
  const locale = await getLocale();

  let items: Awaited<ReturnType<typeof listCatalogue>> = [];
  try {
    items = await listCatalogue();
  } catch (error) {
    console.error("Failed to load catalogue for the makers page", error);
  }

  const sold = await soldHandles();

  // Biographies are optional. A maker with no row still gets name and works;
  // a row only ever adds what the maker supplied. Never a drafted biography.
  const artistRows = await listArtists(locale);
  const artistsBySlug = new Map(artistRows.map((a) => [a.slug, a]));

  // Group by maker as recorded on the product. The key is the artist string
  // itself so two spellings stay separate rather than being merged into a
  // person who may not exist. Sorted by name for a stable page order.
  const byMaker = new Map<string, typeof items>();
  for (const item of items) {
    const maker = item.artist?.trim();
    if (!maker) continue;
    const bucket = byMaker.get(maker);
    if (bucket) bucket.push(item);
    else byMaker.set(maker, [item]);
  }
  const makers = [...byMaker.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[
          { label: t("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
      />

      <section className="border-b border-sand-border/60 pb-16 lg:pb-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          {makers.length > 0 ? (
            <div className="space-y-20">
              {makers.map(([maker, works]) => {
                const artist = artistsBySlug.get(slugify(maker));
                return (
                <article key={maker} id={slugify(maker)} className="scroll-mt-28">
                  {/* A maker entry is a caption, then the works.

                      A biography appears only when the maker wrote one: it is
                      a factual claim about a living person, so an empty row is
                      correct and a drafted one would be a lie. */}
                  <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-sand-border/60 pb-4">
                    <h2 className="font-serif text-2xl font-semibold leading-tight text-deep-ink sm:text-3xl">
                      {maker}
                    </h2>
                    <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-terracotta">
                      {t("worksCount", { count: works.length })}
                    </p>
                  </header>

                  {artist && (artist.bio || artist.region || artist.portrait) && (
                    <div className="mt-6 grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8">
                      {artist.portrait && (
                        <img
                          src={artist.portrait}
                          alt=""
                          aria-hidden="true"
                          className="h-40 w-32 object-cover grayscale-[15%]"
                        />
                      )}
                      <div className={artist.portrait ? "" : "sm:col-span-2"}>
                        {(artist.region || artist.years_active) && (
                          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-terracotta">
                            {[artist.region, artist.years_active]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {artist.bio && (
                          <p className="mt-2 max-w-2xl whitespace-pre-line font-serif text-[17px] leading-relaxed text-muted-ink">
                            {artist.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Every work, not a preview of four.

                      The page used to show the first four and offer "View works"
                      pointing at /shop — the whole catalogue, unfiltered. With
                      one maker holding twenty-one pieces that left seventeen of
                      them reachable from nowhere on this page, and the link
                      delivered the visitor to someone else's work. A directory
                      of makers that hides most of the work is not a directory. */}
                  <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                    {works.map((item) => (
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
                        collection={item.collection}
                      />
                    ))}
                  </div>
                </article>
                );
              })}
              <p className="max-w-2xl border-t border-sand-border/60 pt-6 font-sans text-[12px] leading-relaxed text-muted-ink/80">
                {t("indexNote")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                {t("empty")}
              </p>
              <p className="mt-2 max-w-md font-sans text-sm text-muted-ink">
                {t("emptyBody")}
              </p>
              <Link
                href="/shop"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                {t("viewWorks")}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
