import Link from "next/link";
import { localeAlternates } from "@/lib/seo";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, KalamBorder } from "@/components/ornaments";
import { ButiField, PaperGrain, JaaliField } from "@/components/grounds";

export const metadata = {
  title: "About",
  description:
    "SnehaVrinda Kala is an Indian art house working directly with artists and craft partners across India — original artwork, handmade pieces, and commissioned work.",
  alternates: localeAlternates("/about"),
};

export default function AboutPage() {
  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Our Story"
        title="A house for Indian art, and the hands that make it"
        intro="We work directly with artists and craft partners across India. The maker stays visible, and the story stays with the work."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "About" }]}
        image="/images/artforms/painting.jpg"
      />

      {/* ── Opening statement ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.5 }} />
        <PaperGrain />
        <div className="relative mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[300px_1fr] lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-6">
            <BotanicalRule className="text-terracotta" />
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              Since the first brushstroke
            </p>
          </div>
          <div className="max-w-2xl space-y-6 font-sans text-base leading-[1.8] text-muted-ink">
            <p className="font-serif text-xl leading-relaxed text-deep-ink sm:text-2xl">
              SnehaVrinda Kala began as a home for art in all its forms — not a
              marketplace for objects, but a place where a tradition and the
              person carrying it stay attached to the work.
            </p>
            <p>
              Every listing shows who made the piece, what it is made from, how
              to care for it, and whether it is ready to ship or made to order.
              Nothing is presented as anonymous. If you cannot name the maker,
              you cannot really know the work.
            </p>
            <p>
              Custom commissions follow a deliberate process — brief, quote,
              proofs, approval, delivery — so you know exactly what to expect
              before a brush touches paper.
            </p>
            <p>
              We believe in fair partner terms, transparent attribution, and
              craft you can trust. The maker stays visible, and the story stays
              with the work.
            </p>
          </div>
        </div>
      </section>

      {/* ── Principles ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
            What we hold to
          </p>
          <span className="mt-2 block h-px w-10 bg-terracotta/60" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-3xl font-semibold text-deep-ink sm:text-4xl">
            Four things we will not compromise
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "The maker is named",
                body: "Every work carries its artist. Attribution is not a marketing line; it is the difference between art and inventory.",
              },
              {
                n: "02",
                title: "Handmade, or it is not here",
                body: "We do not sell prints presented as originals, and we do not stock imported goods dressed as craft.",
              },
              {
                n: "03",
                title: "Fair terms, stated plainly",
                body: "Artists are paid on agreed terms with milestones, and commissions are quoted before any work begins.",
              },
              {
                n: "04",
                title: "Nothing is rushed",
                body: "Some pieces take weeks. Natural pigment, handloom cloth and made-to-order work have their own pace, and we keep it.",
              },
            ].map((item) => (
              <div key={item.n} className="border-t border-terracotta/40 pt-5">
                <span className="font-sans text-xs font-semibold tracking-[0.2em] text-terracotta">
                  {item.n}
                </span>
                <h3 className="mt-2 font-serif text-xl font-semibold text-deep-ink">
                  {item.title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Behind the scenes ─────────────────────────────────────────────
          A brief asks Studio to carry the creative process and the world behind
          the work, not just a mission statement. This is the room with the
          lights on: what actually happens between a brief and a finished piece,
          told as a sequence with a picture rather than four more paragraphs. */}
      <section className="relative overflow-hidden border-y border-sand-border/60 bg-surface/40 py-16 lg:py-24">
        <JaaliField style={{ opacity: 0.35 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <figure className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/60">
              <Image
                src="/images/artforms/folk.jpg"
                alt="A work in progress in the studio"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </figure>

            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                Behind the scenes
              </p>
              <h2 className="mt-3 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.01em] text-deep-ink sm:text-[40px]">
                What happens before you see it
              </h2>

              <ol className="mt-8 space-y-6">
                {[
                  {
                    t: "The ground is prepared",
                    d: "Cloth is stiffened with tamarind seed and chalk, or paper is sized, or the panel is primed. Nothing is painted on an unprepared surface.",
                  },
                  {
                    t: "The line goes down first",
                    d: "In most of these traditions the drawing is a single unbroken discipline. The border is often drawn last but planned first.",
                  },
                  {
                    t: "Colour is laid in flat",
                    d: "Natural pigment, often made in the studio. Shading is rare; a form is read by its outline and its fill.",
                  },
                  {
                    t: "It is signed, and it is explained",
                    d: "The maker's name, and usually a note of what the symbols mean. That note is what travels with the work.",
                  },
                ].map((step, i) => (
                  <li key={step.t} className="flex gap-5">
                    <span className="mt-0.5 font-serif text-lg font-semibold text-terracotta/60 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="border-l border-sand-border/70 pl-5">
                      <h3 className="font-serif text-lg font-semibold text-deep-ink">
                        {step.t}
                      </h3>
                      <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                        {step.d}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
      {/* ── Closing invitation ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2A120C]">
        <Image
          src="/images/artforms/textile.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2A120C] via-[#2A120C]/85 to-[#2A120C]/50" />
        <KalamBorder className="absolute inset-x-0 top-0 text-haldi/30" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <h2 className="font-serif text-3xl font-semibold leading-tight text-rang-paper sm:text-4xl">
              Begin with a piece, or with an idea
            </h2>
            <p className="mt-3 font-sans text-small leading-relaxed text-rang-paper/80">
              Browse what is finished, or send a brief and let an artist make
              something that does not exist yet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
              >
                Browse the collection
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/custom-art"
                className="inline-flex items-center gap-2 rounded-full border border-rang-paper/40 px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:border-haldi hover:text-haldi"
              >
                Request a piece
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
