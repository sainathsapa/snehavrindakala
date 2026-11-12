import Link from "next/link";
import Image from "next/image";
import {
  ArrowLink,
  SectionIntro,
  BotanicalRule,
  KalamBorder,
  PaisleyField,
  MandalaField,
} from "@/components/ornaments";
import { listCatalogue } from "@/lib/catalogue";
import { formatPrice } from "@/lib/medusa";
import {
  listHeroSlides,
  listArtForms,
  listFeaturedCategories,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Everything curated lives in Postgres and is edited at /admin/content.
  const [slides, artForms, categories, catalogue] = await Promise.all([
    listHeroSlides(),
    listArtForms(),
    listFeaturedCategories(),
    listCatalogue().catch(() => []),
  ]);

  const hero = slides[0];
  const featuredProducts = catalogue.slice(0, 4);
  const featuredForms = artForms.slice(0, 5);

  return (
    <main className="bg-rang-paper">
      {/* ── Hero ──────────────────────────────────────────────────────────
          Full-bleed artwork with the headline over a pale left gradient, as in
          the reference: no card, no border — the illustration is the section. */}
      <section className="relative min-h-[520px] overflow-hidden bg-rang-paper lg:min-h-[640px]">
        {hero?.image && (
          <Image
            src={hero.image}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover object-right"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-rang-paper from-30% via-rang-paper/70 via-50% to-transparent to-75% lg:via-rang-paper/45 lg:via-42% lg:to-65%" />
        <KalamBorder className="absolute inset-x-0 top-0 text-terracotta/40" />

        <div className="relative mx-auto flex max-w-[1400px] flex-col justify-center px-5 py-16 sm:px-8 lg:min-h-[640px] lg:px-12 lg:py-24">
          <div className="max-w-xl">
            {hero?.eyebrow && (
              <p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
                {hero.eyebrow}
              </p>
            )}
            <h1 className="font-serif text-[44px] font-semibold leading-[1.05] tracking-tight text-deep-ink sm:text-[60px] lg:text-[76px]">
              {hero?.title ?? "Where Indian Art Comes Alive"}
            </h1>
            {hero?.tagline && (
              <p className="mt-5 font-serif text-lg italic text-muted-ink sm:text-xl">
                {hero.tagline}
              </p>
            )}
            <Link
              href={hero?.cta_href || "/shop"}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-7 py-3.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus:ring-2 focus:ring-kumkum focus:ring-offset-2 focus:ring-offset-rang-paper"
            >
              {hero?.cta_label || "Begin the Journey"}
              <span aria-hidden="true">→</span>
            </Link>

            {/* Slide indicator, only when there is more than one slide. */}
            {slides.length > 1 && (
              <div className="mt-12 flex items-center gap-3 font-sans text-xs text-muted-ink">
                <span className="font-semibold text-deep-ink">01</span>
                <span className="h-px w-8 bg-sand-border" aria-hidden="true" />
                <span>{String(slides.length).padStart(2, "0")}</span>
                <span className="ml-2 flex items-center gap-1" aria-hidden="true">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink">
                    ←
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink">
                    →
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Statement strip ─────────────────────────────────────────────────
          A short editorial line between the hero and the first row, with the
          botanical mark that recurs through the references. */}
      <section className="border-y border-sand-border/60 bg-surface/60 py-10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 sm:px-8 lg:px-12">
          <BotanicalRule className="hidden shrink-0 text-terracotta sm:flex" />
          <p className="font-serif text-lg leading-relaxed text-deep-ink sm:text-xl">
            Every piece here was made by a hand that learned the form from
            someone. We work directly with makers across India so the story
            travels with the work.
          </p>
        </div>
      </section>

      {/* ── Indian Art Forms ─────────────────────────────────────────────── */}
      <section className="relative border-b border-sand-border/60 py-14 lg:py-20">
        <PaisleyField className="pointer-events-none absolute right-0 top-10 hidden h-64 w-64 text-terracotta/[0.07] lg:block" />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
            <SectionIntro
              eyebrow="Explore"
              title={
                <>
                  Indian Art
                  <br />
                  Forms
                </>
              }
              description="Discover the timeless beauty of India's rich artistic traditions."
            />

            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {featuredForms.map((form) => (
                  <Link
                    key={form.slug}
                    href={`/shop/${form.slug}`}
                    className="group"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-sm bg-surface ring-1 ring-sand-border/50">
                      <Image
                        src={form.image}
                        alt={form.name}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <h3 className="mt-3 font-serif text-base font-semibold text-deep-ink transition-colors group-hover:text-kumkum">
                      {form.name}
                    </h3>
                    <span className="mt-0.5 inline-flex items-center gap-1 font-sans text-xs text-terracotta">
                      View Collection
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
              <ArrowLink href="/art-forms" className="mt-8">
                Explore All Art Forms
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
            <ArrowLink href="/artists" tone="light" className="mt-6">
              Explore the Journey
            </ArrowLink>
          </div>
        </div>
      </section>

      {/* ── Curated for you ──────────────────────────────────────────────── */}
      <section className="relative py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
            <SectionIntro
              eyebrow="Featured Artworks"
              title="Curated for You"
              description="Bring home a piece of India's soul."
            />

            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {featuredProducts.map((product) => (
                  <Link
                    key={product.handle}
                    href={`/products/${product.handle}`}
                    className="group"
                  >
                    <div className="rounded-sm bg-surface p-3 ring-1 ring-sand-border/40">
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={product.image}
                          alt={product.title}
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    </div>
                    <h3 className="mt-3 font-serif text-sm font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                      {product.title}
                    </h3>
                    <p className="mt-0.5 font-sans text-xs text-muted-ink">
                      {formatPrice(product.price)}
                    </p>
                  </Link>
                ))}
              </div>
              <ArrowLink href="/shop" className="mt-8">
                Shop the Collection
              </ArrowLink>
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

      {/* ── Custom art panel ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-lg bg-kumkum px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
            <MandalaField className="pointer-events-none absolute -right-6 -top-8 h-56 w-56 text-haldi/25 lg:h-72 lg:w-72" />
            <div className="relative max-w-md">
              <h2 className="font-serif text-3xl font-semibold leading-tight text-rang-paper sm:text-4xl">
                Custom Art Requests
              </h2>
              <p className="mt-3 font-sans text-small text-rang-paper/80">
                Have an idea? Let&apos;s create it together — portraits,
                paintings, décor and event artwork made to order.
              </p>
              <Link
                href="/custom-art"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
              >
                Let&apos;s Create
                <span aria-hidden="true">→</span>
              </Link>
            </div>
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
                  The Art of India
                </h2>
                <p className="mt-3 font-sans text-small leading-relaxed text-rang-paper/80">
                  Every tradition here began with a maker, a material and a
                  reason. We work directly with artists across India so the
                  story travels with the piece.
                </p>
                <Link
                  href="/about"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
                >
                  Know More
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How custom art works ─────────────────────────────────────────── */}
      <section className="border-t border-sand-border/60 py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <SectionIntro
            eyebrow="The Process"
            title="How custom art works"
            align="center"
          />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Share your brief",
                body: "Tell us the idea, medium, size, budget and timeline you have in mind.",
              },
              {
                n: "02",
                title: "Receive a quote",
                body: "An artist reviews feasibility and sends a versioned quote with milestones.",
              },
              {
                n: "03",
                title: "Create and deliver",
                body: "Approve proofs, then receive the finished piece and track its delivery.",
              },
            ].map((step) => (
              <div key={step.n} className="border-t border-terracotta/40 pt-5">
                <span className="font-sans text-xs font-semibold tracking-[0.2em] text-terracotta">
                  {step.n}
                </span>
                <h3 className="mt-2 font-serif text-xl font-semibold text-deep-ink">
                  {step.title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
