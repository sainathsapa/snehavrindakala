import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, SectionIntro, ArrowLink } from "@/components/ornaments";
import { ButiField, PaperGrain } from "@/components/grounds";
import { listTestimonials } from "@/lib/site-content";

export const metadata = {
  title: "Authenticity & provenance",
  description:
    "How a SnehaVrinda Kala work reaches you: made by hand in India, signed by the artist, documented before it is packed, and dispatched with a written record of what it is and where it came from.",
  alternates: { canonical: "/authenticity" },
};

// Reads testimonials from Postgres, so it must not be frozen at build time —
// otherwise a quote added in the admin never appears here.
export const dynamic = "force-dynamic";

/**
 * The page that answers the objection every serious art buyer has.
 *
 * A premium handmade piece asks someone to spend real money on an object they
 * cannot touch. The thing standing in the way is not price, it is doubt: is this
 * actually handmade, is it actually what it claims, and what happens if it
 * arrives wrong. This page answers those three directly rather than with a
 * badge, because a claim of authenticity that is only a graphic is worth
 * nothing.
 */

const ASSURANCES = [
  {
    title: "One pair of hands",
    body: "Every work on this site is made by the artist named on it. Nothing is resold from a wholesale catalogue, and nothing is machine-printed and called handmade. If a piece took a month, the making time is stated on the product page before you buy.",
  },
  {
    title: "Signed and dated",
    body: "Paintings and drawings arrive signed. Textile and craft pieces carry a maker's label sewn or stamped on. The signature is not a decoration — it is what lets a piece be identified later, and it is the first thing to look at if you ever resell or insure it.",
  },
  {
    title: "Photographed before packing",
    body: "Each piece is photographed as finished, from more than one angle, before it is wrapped. Those photographs are the record we send you, and they are the reference we use ourselves if there is ever a question about condition.",
  },
  {
    title: "A written record",
    body: "Your parcel includes a card stating the work's title, the artist, the materials, the art form and the date it was completed. It is written for the drawer, not the website — the thing you keep when the packaging is gone.",
  },
  {
    title: "Natural variation is the point",
    body: "Handmade work is not uniform. Dye lots differ, a brush line is not a printed edge, handloom cloth has slubs. We describe material and finish on each listing, and variation within that description is a sign the piece was made by a person.",
  },
  {
    title: "If it is not right, it goes back",
    body: "If a piece arrives damaged, or materially different from its description and photographs, we make it right: replacement where the work can be repeated, refund where it cannot. See the returns policy for how to start that.",
  },
];

const WHAT_WE_WILL_NOT_DO = [
  "We will not sell a print and call it an original painting.",
  "We will not put another maker's name on a piece to sell it faster.",
  "We will not use a stock photograph in place of the actual work you will receive, except where a piece is made to order and the listing says so.",
];

export default async function AuthenticityPage() {
  const testimonials = await listTestimonials();

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Authenticity"
        title="What you are actually buying"
        intro="A handmade work asks you to trust a photograph. Here is exactly what stands behind it, and what happens if it is ever wrong."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Authenticity" }]}
        image="/images/artforms/painting.jpg"
      />

      {/* ── The six assurances ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.4 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ASSURANCES.map((item, index) => (
              <article
                key={item.title}
                className="relative border-t border-sand-border/70 pt-5"
              >
                <span className="font-serif text-sm text-terracotta">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-1 font-serif text-xl text-deep-ink">
                  {item.title}
                </h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What we refuse to do ───────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 bg-surface/40 py-14 lg:py-20">
        <div className="relative mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[300px_1fr] lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-6">
            <BotanicalRule className="text-terracotta" />
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              The lines we hold
            </p>
          </div>
          <div className="max-w-2xl">
            <ul className="space-y-4">
              {WHAT_WE_WILL_NOT_DO.map((line) => (
                <li
                  key={line}
                  className="flex gap-4 border-b border-sand-border/60 pb-4 font-sans text-base leading-relaxed text-deep-ink"
                >
                  <span aria-hidden="true" className="text-terracotta">
                    —
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-sans text-sm leading-relaxed text-muted-ink">
              If you ever believe a piece was misdescribed, write to{" "}
              <a
                className="text-terracotta underline decoration-sand-border underline-offset-4 hover:decoration-terracotta"
                href="mailto:hello@snehavrinda.in"
              >
                hello@snehavrinda.in
              </a>{" "}
              with the order reference. We would rather take a piece back than
              have someone own something they were misled about.
            </p>
          </div>
        </div>
      </section>

      {/* ── Buyer words, straight from the database ────────────────────── */}
      {testimonials.length > 0 && (
        <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
          <PaperGrain />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <SectionIntro
              eyebrow="In their words"
              title="From people who have the work at home"
              align="center"
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {testimonials.map((t) => (
                <figure
                  key={t.id}
                  className="border-t border-sand-border/70 pt-5"
                >
                  <blockquote className="font-serif text-lg leading-relaxed text-deep-ink">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-3 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
                    {t.author}
                    {t.location ? ` · ${t.location}` : ""}
                    {t.work ? ` · ${t.work}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Close ──────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-3">
            <ArrowLink href="/policies/shipping">How it is packed and shipped</ArrowLink>
            <ArrowLink href="/policies/returns">If something arrives wrong</ArrowLink>
            <ArrowLink href="/custom-art">Commission a piece</ArrowLink>
          </div>
        </div>
      </section>
    </main>
  );
}
