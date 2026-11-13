import { medusa } from "@/lib/medusa";
import { listCatalogue } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import { BotanicalRule } from "@/components/ornaments";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  try {
    const artists = await medusa.listAllArtists({ limit: 500 });
    return artists.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Next 15 can call this from a client MetadataOutlet with no params; guard
  // rather than throwing and taking the route down.
  const slug = (await params)?.slug ?? "";
  if (!slug) return { title: "SnehaVrinda Kala" };
  let artist: any = null;
  try {
    const { artist: artistData } = await medusa.getArtist(slug);
    artist = artistData;
  } catch {
    // handled in component
  }
  if (!artist) return { title: "Artist not found" };
  return {
    title: artist.display_name,
    description:
      artist.bio ||
      `${artist.display_name} is an artist featured on SnehaVrinda Kala.`,
    alternates: {
      canonical: `/artists/${artist.slug}`,
    },
    openGraph: {
      title: artist.display_name,
      description: artist.bio || undefined,
      // "profile" is not in Next's OpenGraph type union; `article` is the closest
      // supported value. The Person semantics live in the JSON-LD block.
      type: "article",
      url: `/artists/${artist.slug}`,
    },
  };
};

export default async function ArtistProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let artist: any = null;
  try {
    const { artist: artistData } = await medusa.getArtist(slug);
    artist = artistData;
  } catch (err) {
    notFound();
  }

  if (!artist) {
    notFound();
  }

  // Their works, matched on the artist name the catalogue carries. The backend
  // does not expose a product-by-artist query, and the catalogue is small, so
  // filtering in memory is both correct and cheap.
  const catalogue = await listCatalogue().catch(() => []);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: artist.display_name,
    jobTitle: artist.disciplines?.[0] || "Artist",
    description: artist.bio || undefined,
    knowsAbout: artist.techniques || undefined,
    url: `${(process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "")}/artists/${artist.slug}`,
  };

  const works = catalogue
    .filter(
      (item) =>
        item.artist &&
        item.artist.trim().toLowerCase() === String(artist.display_name).trim().toLowerCase()
    )
    .slice(0, 8);

  return (
    <main className="bg-rang-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* ── Masthead ───────────────────────────────────────────────────────
          A portrait beside the artist's name and discipline, the way a gallery
          introduces a show. The name is the headline — not "Artist Profile". */}
      <section className="border-b border-sand-border/60">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-12 lg:py-20">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/60">
            {artist.portrait_media_id ? (
              <img
                src={`/images/artists/${artist.portrait_media_id}.jpg`}
                alt={artist.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-serif text-sm italic text-muted-ink/60">
                  Portrait to follow
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <nav
              aria-label="Breadcrumb"
              className="mb-6 flex items-center gap-2 font-sans text-xs text-muted-ink"
            >
              <Link href="/" className="transition-colors hover:text-kumkum">
                Home
              </Link>
              <span aria-hidden="true">›</span>
              <Link href="/artists" className="transition-colors hover:text-kumkum">
                Artists
              </Link>
            </nav>

            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              Maker
            </p>
            <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05] tracking-tight text-deep-ink sm:text-[56px]">
              {artist.display_name}
            </h1>

            {artist.disciplines?.length > 0 && (
              <p className="mt-4 font-serif text-lg italic text-muted-ink">
                {artist.disciplines.join(" · ")}
              </p>
            )}

            {artist.bio && (
              <p className="mt-6 max-w-xl font-sans text-base leading-[1.8] text-muted-ink">
                {artist.bio}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-sans text-[11px] uppercase tracking-[0.16em]">
              {artist.commission_available ? (
                <span className="text-kumkum">Commissions open</span>
              ) : (
                <span className="text-muted-ink/70">Not accepting commissions</span>
              )}
              {artist.is_verified && <span className="text-terracotta">Verified maker</span>}
            </div>

            {artist.commission_available && (
              <Link
                href="/custom-art"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                Commission this artist
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Practice ─────────────────────────────────────────────────────── */}
      {artist.techniques?.length > 0 && (
        <section className="border-b border-sand-border/60 py-14">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              Practice
            </p>
            <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {artist.techniques.map((t: string, i: number) => (
                <li
                  key={t}
                  className="flex items-baseline gap-3 border-t border-sand-border/60 pt-3"
                >
                  <span className="font-sans text-[10px] font-semibold tracking-[0.18em] text-terracotta">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-base text-deep-ink">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Their works ──────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-sand-border/60 pb-5">
            <h2 className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
              Works by {artist.display_name.split(" ")[0]}
            </h2>
            <Link
              href="/shop"
              className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
            >
              the whole collection →
            </Link>
          </div>

          {works.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {works.map((item) => (
                <ProductCard
                  key={item.handle}
                  handle={item.handle}
                  title={item.title}
                  artist={item.artist}
                  price={item.price}
                  stockType={item.stockType}
                  image={item.image}
                  isNew={item.isNew}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                Nothing by this maker is available right now.
              </p>
              <p className="mt-2 font-sans text-sm text-muted-ink">
                Work is added as it is finished.
              </p>
              <Link
                href="/artists"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-sand-border px-6 py-3 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum"
              >
                Meet the other makers
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
