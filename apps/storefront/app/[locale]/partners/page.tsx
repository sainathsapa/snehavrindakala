import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { localeAlternates } from "@/lib/seo";
import { partnersCopy } from "@/lib/page-copy";

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

  const c = partnersCopy(locale);

  const audiences = c.audiences;
  const steps = c.steps;
  const arranged = c.arranged;

  return (
    <main className="bg-rang-paper pb-24">
      <PageHeader
        eyebrow={c.eyebrow}
        title={c.title}
        intro={c.intro}
        breadcrumb={[{ label: c.crumbHome, href: "/" }, { label: c.title }]}
      />

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* ── Who it is for ─────────────────────────────────────────────── */}
        <section className="border-t border-sand-border/70 pt-10">
          <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">{c.whoHeading}</h2>
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
            <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">{c.howHeading}</h2>
            <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted-ink">
              {c.howNote}
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
          <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">{c.arrangedHeading}</h2>
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
            {c.arrangedIntro}
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
              <h2 className="font-serif text-2xl text-deep-ink">{c.newHeading}</h2>
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-ink">
                {c.newBody}
              </p>
              <Link
                href="/partner/apply"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-sindoor px-6 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-kumkum"
              >
                {c.newCta} <span aria-hidden="true">→</span>
              </Link>
              <p className="mt-4 font-sans text-[13px] leading-relaxed text-muted-ink">
                {c.buyForRoom}{" "}
                <Link href="/contact" className="text-sindoor underline underline-offset-4">
                  {c.writeToStudio}
                </Link>
                .
              </p>
            </div>

            <div className="rounded-lg border border-sand-border p-6 sm:p-8">
              <h2 className="font-serif text-2xl text-deep-ink">{c.existingHeading}</h2>
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-ink">
                {c.existingBody}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/partner/login"
                  className="inline-flex min-h-11 items-center rounded-full border border-sand-border px-6 font-sans text-sm text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
                >
                  {c.signIn}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center px-2 font-sans text-sm text-muted-ink transition-colors hover:text-sindoor"
                >
                  {c.askInstead}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {true ? (
          <section className="mt-16 border-t border-sand-border/70 pt-10">
            <h2 className="font-serif text-2xl text-deep-ink sm:text-3xl">{c.sellHeading}</h2>
            <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-muted-ink">
              {c.sellBody}
            </p>
            <Link
              href="/sell"
              className="mt-5 inline-flex items-center gap-2 font-sans text-sm text-sindoor underline underline-offset-4"
            >
              {c.sellCta} <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : null}

        <div className="mt-14 flex flex-col items-center text-center">
          <BotanicalRule className="mb-5 text-terracotta" />
          <p className="max-w-lg font-serif text-[15px] italic leading-relaxed text-muted-ink">
            {c.footerNote}
          </p>
        </div>
      </div>
    </main>
  );
}
