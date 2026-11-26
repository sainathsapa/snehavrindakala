import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Partners · SnehaVrinda Kala",
    description:
      "Working with the studio as a trade partner: galleries, interior designers, hospitality and corporate gifting. Apply to partner, or sign in to the partner portal.",
    alternates: localeAlternates("/partners", locale),
  };
}

/**
 * The partners page.
 *
 * Before this, the only way to find the partner programme was to already know
 * the URL: the application form lived at /partner/apply with nothing linking to
 * it, so a gallery that wanted to work with the studio had no path in from the
 * website at all. This is the doorway — who the programme is for, how it
 * actually runs, and the two things a visitor needs (apply, or sign in).
 *
 * Nothing here promises trade discounts, volumes or turnaround times, because
 * those are agreed case by case; a page that invents a percentage is a page that
 * has to be walked back in the first email.
 */
export default async function PartnersPage() {
  const locale = await getLocale();

  const audiences = [
    {
      title: "Galleries & curators",
      body: "Work for a show, a season or a standing display. We can hold a selection, supply condition reports and photographs sized for print.",
    },
    {
      title: "Interior designers & architects",
      body: "Pieces chosen against a room rather than a listing. Tell us the wall, the light and the budget and we will propose what fits it.",
    },
    {
      title: "Hospitality & offices",
      body: "Lobbies, suites and meeting rooms, where a work has to survive daily proximity to people. We will say plainly which materials will.",
    },
    {
      title: "Corporate gifting",
      body: "Repeatable orders of small works and objects, with the invoicing and documentation a finance department needs.",
    },
  ];

  const steps = [
    {
      numeral: "01",
      title: "Write to us",
      body: "Use the application form. What you do, where you are, and the kind of work you are looking for is enough to start.",
    },
    {
      numeral: "02",
      title: "A conversation",
      body: "A person replies — usually within a few working days — with questions about the space, the timeline and the budget, or with a straight no.",
    },
    {
      numeral: "03",
      title: "Terms, then work",
      body: "Price, lead time, packing, shipping and payment are agreed in writing before anything is made or dispatched.",
    },
  ];

  return (
    <main className="bg-rang-paper pb-24">
      <PageHeader
        eyebrow="For galleries & trade"
        title="Partners"
        intro="The studio works with a small number of galleries, designers, hotels and offices. If you buy for a room rather than for yourself, this is the way in."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Partners" }]}
      />

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* ── Who it is for ─────────────────────────────────────────────── */}
        <section className="border-t border-sand-border/70 pt-10">
          <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">Who we work with</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {audiences.map((item) => (
              <div key={item.title} className="border-t border-sand-border/60 pt-4">
                <h3 className="font-serif text-xl leading-snug text-deep-ink">{item.title}</h3>
                <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-ink">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it runs ───────────────────────────────────────────────── */}
        <section className="mt-16 border-t border-sand-border/70 pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">How it runs</h2>
            <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted-ink">
              Three steps, no forms after the first
            </p>
          </div>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.numeral}>
                <span className="font-serif text-3xl leading-none text-sindoor/35">
                  {step.numeral}
                </span>
                <h3 className="mt-2 font-serif text-lg text-deep-ink">{step.title}</h3>
                <p className="mt-1.5 font-sans text-[15px] leading-relaxed text-muted-ink">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── What can be arranged ──────────────────────────────────────── */}
        <section className="mt-16 border-t border-sand-border/70 pt-10">
          <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">What can be arranged</h2>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
            Terms are agreed for each partnership rather than published as a table. These are the
            things that are normally part of one.
          </p>
          <ul className="mt-6 grid gap-x-10 gap-y-3 font-sans text-[15px] text-deep-ink/90 sm:grid-cols-2">
            {[
              "A held selection, photographed and set aside for your dates",
              "Condition reports and print-resolution images for catalogues",
              "Consolidated shipping, crated, with a single invoice",
              "Invoices issued by the studio, with the documentation your accounts team asks for",
              "Commissioned work made to a brief, with the lead time stated in writing",
              "A named person at the studio for the length of the partnership",
            ].map((line) => (
              <li key={line} className="flex gap-3 border-t border-sand-border/50 pt-3">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/60" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Two doors ─────────────────────────────────────────────────── */}
        <section className="mt-16 border-t border-sand-border/70 pt-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-sand-border bg-surface p-6 sm:p-8">
              <h2 className="font-serif text-2xl text-deep-ink">New partnership</h2>
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-ink">
                Tell us about your business and the work you have in mind — a gallery, a practice, a
                studio. Every application is read by a person and answered either way.
              </p>
              <Link
                href="/partner/apply"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-sindoor px-6 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-kumkum"
              >
                Apply to partner <span aria-hidden="true">→</span>
              </Link>
              <p className="mt-4 font-sans text-[13px] leading-relaxed text-muted-ink">
                Buying for a room rather than applying to sell?{" "}
                <Link href="/contact" className="text-sindoor underline underline-offset-4">
                  Write to the studio
                </Link>
                .
              </p>
            </div>

            <div className="rounded-lg border border-sand-border p-6 sm:p-8">
              <h2 className="font-serif text-2xl text-deep-ink">Already a partner</h2>
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-ink">
                Your orders, held stock, shipments, statements and settlement history are in the
                partner portal.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/partner/login"
                  className="inline-flex min-h-11 items-center rounded-full border border-sand-border px-6 font-sans text-sm text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
                >
                  Partner sign in
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center px-2 font-sans text-sm text-muted-ink transition-colors hover:text-sindoor"
                >
                  Ask a question instead
                </Link>
              </div>
            </div>
          </div>
        </section>

        {true ? (
          <section className="mt-16 border-t border-sand-border/70 pt-10">
            <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">Makers: sell with us</h2>
            <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
              If you make work rather than buy it, the seller route is the one you want: what we ask
              of a maker, how the review runs, and how payouts are recorded. The application form
              lives there, so there is one place to start rather than two.
            </p>
            <Link
              href="/sell"
              className="mt-5 inline-flex items-center gap-2 font-sans text-sm text-sindoor underline underline-offset-4"
            >
              Selling as a maker <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : null}

        <div className="mt-14 flex flex-col items-center text-center">
          <BotanicalRule className="mb-5 text-terracotta" />
          <p className="max-w-lg font-serif text-[15px] italic leading-relaxed text-muted-ink">
            Trade enquiries are answered by the studio itself, not a sales desk — the same people
            who pack the work are the ones who reply.
          </p>
        </div>
      </div>
    </main>
  );
}
