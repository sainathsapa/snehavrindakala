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
import { HeroSlider } from "@/components/hero-slider";
import { listCatalogue } from "@/lib/catalogue";
import { formatPrice } from "@/lib/medusa";
import {
  listHeroSlides,
  listArtForms,
  listFeaturedCategories,
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
  // Everything curated lives in Postgres and is edited at /admin/content.
  const [slides, artForms, categories, catalogue] = await Promise.all([
    listHeroSlides(),
    listArtForms(),
    listFeaturedCategories(),
    listCatalogue().catch(() => []),
  ]);

  const featuredProducts = catalogue.slice(0, 4);
  const featuredForms = artForms.slice(0, 5);

  return (
    <main className="bg-rang-paper">
      {/* ── Hero carousel ─────────────────────────────────────────────────
          Slides are admin-managed and genuinely cycle: auto-advance, arrows,
          dots, swipe and keyboard, pausing on hover and focus. */}
      <div className="relative">
        <HeroSlider slides={slides} />
        <KalamBorder className="pointer-events-none absolute inset-x-0 top-0 text-terracotta/40" />
      </div>

      {/* ── Statement strip ─────────────────────────────────────────────────
          A short editorial line between the hero and the first row, with the
          botanical mark that recurs through the references. */}
      <section className="relative overflow-hidden border-y border-sand-border/60 bg-surface/60 py-10">
        <PaisleyField className="pointer-events-none absolute -left-10 top-0 hidden h-40 w-40 text-terracotta/[0.08] md:block" />
        <div className="relative mx-auto flex max-w-[1400px] items-center gap-6 px-5 sm:px-8 lg:px-12">
          <BotanicalRule className="hidden shrink-0 text-terracotta sm:flex" />
          <p className="font-serif text-lg leading-relaxed text-deep-ink sm:text-xl">
            Every piece here was made by a hand that learned the form from
            someone. We work directly with makers across India so the story
            travels with the work.
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

      {/* ── Selected works ─────────────────────────────────────────────────
          Presented as a gallery wall rather than a product row: one work leads,
          the rest sit beside it as plates, and the captions read like labels. */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-sand-border/60 pb-6">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
                Selected works
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-deep-ink sm:text-[42px]">
                From the studio
              </h2>
            </div>
            <ArrowLink href="/shop">See the full collection</ArrowLink>
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
                    {formatPrice(product.price)}
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
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-rang-paper ring-1 ring-sand-border/60 lg:aspect-square">
            <Image
              src="/images/artforms/folk.jpg"
              alt="Madhubani work in progress"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>

          <div className="max-w-xl">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              Artist in focus
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug text-deep-ink sm:text-3xl">
              &ldquo;My grandmother never signed her work. I sign mine, and I
              write down what she taught me.&rdquo;
            </h2>
            <p className="mt-5 font-sans text-small leading-relaxed text-muted-ink">
              Madhubani is painted with a nib, a twig and a fingertip. A single
              panel can take a fortnight, and the border you think is decoration
              is often a genealogy — the fish for fertility, the bamboo for
              endurance, the parrot for the messenger.
            </p>
            <p className="mt-4 font-sans text-small leading-relaxed text-muted-ink">
              We work with makers who have inherited their form and are teaching
              it on. Every work on this site names the hand that made it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                Meet the artists
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/art-forms"
                className="inline-flex items-center gap-2 rounded-full border border-sand-border px-6 py-3 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum"
              >
                Explore the traditions
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
