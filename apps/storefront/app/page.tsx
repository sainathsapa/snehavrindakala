import Link from "next/link";
import { artFormSlugs } from "@/lib/slugs";
import { ArrowLink, SectionIntro } from "@/components/ornaments";

const artForms = artFormSlugs.map((form) => ({
  name: form.name,
  description: form.description,
  href: `/shop/${form.slug}`,
  // Art-form SVGs are named after the short slug (painting.svg, folk.svg), not
  // the slugified display name — slugifying "Painting & Drawing" produced
  // "painting-and-drawing.svg", which does not exist, so every category card
  // rendered as a broken image.
  image: `/images/artforms/${form.slug}.svg`,
}));

/** The five forms the reference features in its first row. */
const featuredForms = artForms.slice(0, 5);

export default function Home() {
  return (
    <main className="bg-rang-paper">
      {/* ── Hero ──────────────────────────────────────────────────────────
          Full-bleed artwork with the headline set over the pale left side, as
          in the reference: no card, no border — the illustration is the section. */}
      <section className="relative min-h-[520px] overflow-hidden bg-rang-paper lg:min-h-[620px]">
        <img
          src="/images/hero/hero-art.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        {/* Widen the pale area behind the copy so text never fights the art. */}
        <div className="absolute inset-0 bg-gradient-to-r from-rang-paper from-30% via-rang-paper/70 via-50% to-transparent to-75% lg:via-rang-paper/45 lg:via-42% lg:to-65%" />

        <div className="relative mx-auto flex max-w-[1400px] flex-col justify-center px-5 py-16 sm:px-8 lg:min-h-[620px] lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <h1 className="font-serif text-[44px] font-semibold leading-[1.05] tracking-tight text-deep-ink sm:text-[60px] lg:text-[76px]">
              Where
              <br />
              Indian Art
              <br />
              Comes Alive
            </h1>
            <p className="mt-5 font-serif text-lg italic text-muted-ink sm:text-xl">
              Explore. Experience. Own.
            </p>
            <Link
              href="/shop"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-7 py-3.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus:ring-2 focus:ring-kumkum focus:ring-offset-2 focus:ring-offset-rang-paper"
            >
              Begin the Journey
              <span aria-hidden="true">→</span>
            </Link>

            <div className="mt-12 flex items-center gap-3 font-sans text-xs text-muted-ink">
              <span className="font-semibold text-deep-ink">01</span>
              <span className="h-px w-8 bg-sand-border" aria-hidden="true" />
              <span>03</span>
              <span className="ml-2 flex items-center gap-1" aria-hidden="true">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink">
                  ←
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink">
                  →
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Indian Art Forms ─────────────────────────────────────────────── */}
      <section className="border-b border-sand-border/60 py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
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
                    key={form.href}
                    href={form.href}
                    className="group"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-sm bg-surface">
                      <img
                        src={form.image}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
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
        <img
          src="/images/products/madhubani-painting.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 left-0 h-full w-full object-cover opacity-40 lg:w-1/2 lg:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2A120C]/80 to-[#2A120C] lg:via-[#2A120C]/70" />

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
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
            <SectionIntro
              eyebrow="Featured Artworks"
              title="Curated for You"
              description="Bring home a piece of India's soul."
            />

            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {artForms.slice(0, 4).map((form) => (
                  <Link key={form.href} href={form.href} className="group">
                    <div className="overflow-hidden rounded-sm bg-surface p-3">
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={form.image}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <h3 className="mt-3 font-serif text-sm font-semibold text-deep-ink">
                      {form.name}
                    </h3>
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

      {/* ── Custom art panel ──────────────────────────────────────────────
          The burgundy promotional panel that closes the reference's first
          screen, with fine gold line art behind it. */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-lg bg-kumkum px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
            <svg
              className="pointer-events-none absolute -right-6 -top-8 h-56 w-56 text-haldi/20 lg:h-72 lg:w-72"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="100" cy="100" r="76" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="56" stroke="currentColor" strokeWidth="1" />
              {Array.from({ length: 12 }).map((_, i) => (
                <ellipse
                  key={i}
                  cx="100"
                  cy="30"
                  rx="9"
                  ry="24"
                  stroke="currentColor"
                  strokeWidth="1"
                  transform={`rotate(${i * 30} 100 100)`}
                />
              ))}
            </svg>

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
