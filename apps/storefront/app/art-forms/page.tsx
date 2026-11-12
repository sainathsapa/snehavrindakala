import Link from "next/link";
import Image from "next/image";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";
import { listArtForms } from "@/lib/site-content";
import { SectionIntro, MandalaField, KalamBorder } from "@/components/ornaments";

export const dynamic = "force-dynamic";

interface ArtFormCard {
  key: string;
  name: string;
  description: string;
  href: string;
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
      image: imageFor(category.handle),
    }));
  } catch (err) {
    console.error("Failed to load product categories from Medusa", err);
  }

  // Admin-managed art forms take priority: they are the curated list the shop
  // owner edits at /admin/content, so they define what this page shows.
  let managed: ArtFormCard[] = [];
  try {
    managed = (await listArtForms()).map((form) => ({
      key: `managed-${form.id}`,
      name: form.name,
      description: form.description,
      href: `/shop/${form.slug}`,
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
      name: form.name,
      description: form.description,
      href: `/shop/${form.slug}`,
      image: imageFor(form.slug),
    });
  }

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
            Indian Art Forms
          </h1>
          <p className="mt-2 font-sans text-small text-rang-paper/75">
            Timeless traditions. Enduring beauty.
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

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
            <SectionIntro
              eyebrow="Explore"
              title="Traditions, by region"
              description="Browse curated collections organized by medium and technique. Each collection shows the maker, materials, and care details."
            />

            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3">
              {catalogue.map((form) => (
                <Link key={form.key} href={form.href} className="group">
                  <div className="relative aspect-square overflow-hidden rounded-sm bg-surface">
                    {form.image ? (
                      <Image
                        src={form.image}
                        alt={form.name}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-terracotta/30"
                        aria-hidden="true"
                      >
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M4 20c0-6 3-10 8-16 1.5 4 4 8 4 11a4 4 0 0 1-8 0c0-1.5.5-3 1-4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-serif text-lg font-semibold text-deep-ink transition-colors group-hover:text-kumkum">
                    {form.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed text-muted-ink">
                    {form.description}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 font-sans text-xs font-medium text-terracotta">
                    Explore
                    <span
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
