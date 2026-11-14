import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Disclaimer — SnehaVrinda Kala",
  description:
    "What SnehaVrinda Kala claims about its artwork, and what it does not: materials, colour variation, photography limits, payment processing and external links.",
};

/**
 * The disclaimer.
 *
 * A disclaimer is only worth having if it states something the buyer did not
 * already know. So this page does not disclaim everything in sight — it says
 * exactly where a reasonable expectation could differ from what arrives, and it
 * does so before the order rather than in a footer after it.
 */
const CLAUSES: { heading: string; body: string[] }[] = [
  {
    heading: "Handmade means variation",
    body: [
      "Every work here is made by hand, one at a time. Brushwork, weave density, glaze pooling, metal patina and the depth of a pigment all vary between pieces, and often within a single piece. That variation is the point of the craft, not a fault in it.",
      "Photographs are taken under studio light and colour-corrected to represent the work as accurately as we can. Screens differ, though: the same madder red can read warm on one display and cool on another. If an exact shade matters to you, ask before ordering and we will send additional photographs in daylight.",
    ],
  },
  {
    heading: "Natural materials age",
    body: [
      "Natural pigments, cotton and silk cloth, wood, brass and silver change over time. Indigo may soften, brass will darken, silver will tarnish. This is expected and is described in the care note sent with each order.",
      "We describe materials as accurately as we can from what the maker used. Where a work incorporates a material we cannot verify — reclaimed wood, for instance, or a pigment a family has mixed for generations — we say so rather than assert a provenance we cannot prove.",
    ],
  },
  {
    heading: "Authenticity we can stand behind",
    body: [
      "Each work is accompanied by a signed certificate naming the artist and the tradition. That is a statement about who made the piece and under which practice, and it is one we can substantiate.",
      "It is not an appraisal. Nothing on this site is a valuation, an investment opinion, or a promise that a piece will hold or gain value. Art is bought because it is worth living with, not because a shop forecast its price.",
    ],
  },
  {
    heading: "Prices, currency and duties",
    body: [
      "Prices are set in Indian rupees. Amounts shown in other currencies are converted from INR at a rate we keep current and rounded for clarity; the amount charged is the one displayed at checkout.",
      "Orders leaving India may attract import duty, VAT or a handling fee levied by the destination country's customs authority. Those charges are the buyer's responsibility and are not included in the price paid to us. We cannot calculate them reliably for every destination and will not pretend otherwise.",
    ],
  },
  {
    heading: "Payment processing",
    body: [
      "Card, UPI and net-banking payments are processed by a third party. We do not receive or store your card number, CVV or UPI PIN. The processor confirms only that a payment succeeded.",
      "For that reason, disputes about a charge are resolved with the processor and your bank as well as with us. If you do not recognise a charge from us, write to hello@snehavrinda.in with the date and amount and we will trace it.",
    ],
  },
  {
    heading: "Cultural reference and language",
    body: [
      "The glossary and journal describe traditions, terms and histories as part of a living practice. Regional names vary — the same motif can carry different words in different states — and we name the variant we mean where it matters.",
      "Where we describe a tradition's history, we rely on published sources and on the makers themselves. If you believe something here misstates a practice, tell us. Corrections from practitioners take precedence over our wording.",
    ],
  },
  {
    heading: "Links and third parties",
    body: [
      "Some pages link to external sites, such as a courier's tracking page or an artisan collective. We do not control those sites and are not responsible for their content or their handling of your data.",
      "Social profiles linked from this site are official accounts of the studio. We do not run, endorse or moderate other accounts using our name.",
    ],
  },
  {
    heading: "Limitation",
    body: [
      "Nothing here excludes liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, or for fraud. Beyond that, our liability for any order is limited to the amount you paid for that order.",
      "This page is written in plain language for clarity. It is not legal advice, and the terms of sale at checkout govern where the two differ.",
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="The fine print"
        title="Disclaimer"
        intro="What we claim about the work, and what we do not. Written to be read before you order rather than discovered afterwards."
        breadcrumb={[{ label: "Disclaimer" }]}
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted-ink">
          Last updated · November 2026
        </p>

        <div className="mt-10 space-y-10">
          {CLAUSES.map((clause) => (
            <section
              key={clause.heading}
              className="border-t border-sand-border pt-6"
            >
              <h2 className="font-serif text-xl font-semibold text-deep-ink">
                {clause.heading}
              </h2>
              <div className="mt-3 space-y-3 font-sans text-[14.5px] leading-relaxed text-muted-ink">
                {clause.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-sand-border bg-surface/70 p-5">
          <p className="font-sans text-sm leading-relaxed text-muted-ink">
            Questions about any of this, or something here that reads
            differently from what you expected? Write to{" "}
            <a
              href="mailto:hello@snehavrinda.in"
              className="underline hover:text-kumkum"
            >
              hello@snehavrinda.in
            </a>
            . The related pages are the{" "}
            <Link href="/policies/terms" className="underline hover:text-kumkum">
              terms of sale
            </Link>
            ,{" "}
            <Link
              href="/policies/privacy"
              className="underline hover:text-kumkum"
            >
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/faq" className="underline hover:text-kumkum">
              FAQ
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
