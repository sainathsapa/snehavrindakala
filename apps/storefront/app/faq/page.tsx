import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { PaymentMarks } from "@/components/payment-marks";

export const metadata: Metadata = {
  title: "FAQ & support — SnehaVrinda Kala",
  description:
    "Answers on shipping, customs, returns, commissions and payment for artwork bought from SnehaVrinda Kala in Bikaner, Rajasthan.",
};

/**
 * The questions buyers actually ask.
 *
 * Written as answers, not as a policy restatement. Where a real constraint
 * exists — an artwork is one of one, customs duty is the buyer's — it says so
 * plainly rather than burying it, because a surprise at delivery costs more
 * trust than a clear sentence here.
 */
const FAQ_SECTIONS: {
  heading: string;
  items: { q: string; a: string }[];
}[] = [
  {
    heading: "Buying",
    items: [
      {
        q: "Is every piece an original?",
        a: "Yes. Each work is painted, woven or shaped by hand, and is a single piece. What you see photographed is the work you receive. Because of that, no two pieces are identical even within the same art form.",
      },
      {
        q: "Why is a piece I saw earlier no longer listed?",
        a: "Originals sell once. When a work is sold it comes off the shop, and we do not offer reproductions of it. If you were looking at something specific, write to us and we will tell you whether something similar is in progress.",
      },
      {
        q: "Can you make something to my size or palette?",
        a: "Often, yes. Commissions start from size, subject and the tradition you have in mind. Begin with the commission request form and you will get a quote with a timeline before any payment.",
      },
      {
        q: "Which currencies can I pay in?",
        a: "Prices are shown in INR, USD, GBP, EUR and AED. Switching the currency in the header converts the catalogue at a rate we keep current; the amount charged is the one shown at checkout.",
      },
    ],
  },
  {
    heading: "Shipping & customs",
    items: [
      {
        q: "Where do you ship?",
        a: "Across India, and to the United States, Canada, the United Kingdom, the European Union and the Gulf. Choose your country at checkout and we quote the courier for that destination.",
      },
      {
        q: "How long does delivery take?",
        a: "Ready-to-ship works leave Bikaner within 2–3 working days. Made-to-order pieces show their production time on the product page. International orders usually add 5–12 days in transit depending on the destination.",
      },
      {
        q: "Will I pay customs duty?",
        a: "Orders leaving India may attract import duty or local tax charged by your customs authority on delivery. That is not included in the price you pay us, and we cannot estimate it reliably for every country. If you need certainty before ordering, write to us and we will tell you what we know for your destination.",
      },
      {
        q: "How is a painting packed?",
        a: "Works are packed in material-specific housing — rigid board and corner protection for canvases, padded rolls for textiles, foam cradles for ceramics and metalwork. Fragile pieces are insured in transit.",
      },
    ],
  },
  {
    heading: "Returns & care",
    items: [
      {
        q: "Can I return a piece?",
        a: "If a work arrives damaged or is not what you ordered, tell us within 48 hours of delivery with photographs and we will arrange a replacement or refund. Change-of-mind returns are accepted within 7 days for ready-to-ship pieces, provided the work is returned in its original packing. Commissions are made for you and cannot be returned.",
      },
      {
        q: "What if a delivery arrives damaged?",
        a: "Photograph the packaging and the work before moving it, then write to us the same day. Keep the packaging until the claim is settled — the courier will usually need to inspect it.",
      },
      {
        q: "How do I care for the work?",
        a: "Keep paintings and textiles out of direct sunlight and away from damp walls. Do not wipe painted surfaces; dust with a dry, soft brush. Metalwork such as bidriware should not be scrubbed — a dry cloth is enough. Each order ships with a care note for its material.",
      },
    ],
  },
  {
    heading: "Payments & security",
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "Cards (Visa, Mastercard, RuPay), UPI including Google Pay and Paytm, and net banking. Payments are processed by Razorpay; card details are entered on their secure page and never touch our servers.",
      },
      {
        q: "Do you store my card details?",
        a: "No. We never see or store card numbers. The payment processor handles the transaction and returns only a confirmation to us.",
      },
      {
        q: "What appears on my statement?",
        a: "The charge appears under our registered business name alongside the payment processor. If you do not recognise a charge, write to us with the date and amount and we will trace it.",
      },
    ],
  },
];

const CONTACT_LINKS = [
  {
    label: "Write to us",
    detail: "hello@snehavrinda.in — replies within one working day",
    href: "mailto:hello@snehavrinda.in",
  },
  {
    label: "Commission a piece",
    detail: "Start with size, subject and tradition",
    href: "/custom-art",
  },
  {
    label: "Track an order",
    detail: "Check the status of a placed order",
    href: "/account",
  },
  {
    label: "Shipping policy",
    detail: "Full dispatch and delivery terms",
    href: "/policies/shipping",
  },
  {
    label: "Returns policy",
    detail: "What is returnable and how",
    href: "/policies/returns",
  },
];

export default function FaqPage() {
  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Support"
        title="Questions, answered"
        intro="Everything buyers ask before ordering — shipping, customs, returns, commissions and how payment works. If your question is not here, write to us and a person will answer."
      />

      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
        <nav aria-label="Questions" className="mb-12 flex flex-wrap gap-2">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.heading}
              href={`#${section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="rounded-full border border-sand-border px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink transition-colors hover:border-kumkum hover:text-kumkum"
            >
              {section.heading}
            </a>
          ))}
        </nav>

        <div className="space-y-14">
          {FAQ_SECTIONS.map((section) => (
            <section
              key={section.heading}
              id={section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}
              className="scroll-mt-28"
            >
              <h2 className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
                {section.heading}
              </h2>
              <BotanicalRule className="mt-4 text-terracotta/60" />
              <dl className="mt-6 divide-y divide-sand-border/70 border-t border-sand-border/70">
                {section.items.map((item) => (
                  <div key={item.q} className="py-5">
                    <dt className="font-serif text-lg font-semibold leading-snug text-deep-ink">
                      {item.q}
                    </dt>
                    <dd className="mt-2 max-w-2xl font-sans text-[14.5px] leading-relaxed text-muted-ink">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <section className="mt-16 border-t border-sand-border pt-10">
          <h2 className="font-serif text-2xl font-semibold text-deep-ink">
            Still need a person
          </h2>
          <p className="mt-2 max-w-2xl font-sans text-[14.5px] leading-relaxed text-muted-ink">
            There is no support bot here. Write to the address below and the
            reply comes from the studio in Bikaner.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CONTACT_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="group flex h-full flex-col justify-between rounded-lg border border-sand-border bg-surface/70 p-4 transition-colors hover:border-kumkum"
                >
                  <span className="font-serif text-base font-semibold text-deep-ink transition-colors group-hover:text-kumkum">
                    {link.label}
                  </span>
                  <span className="mt-1.5 font-sans text-xs leading-relaxed text-muted-ink">
                    {link.detail}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-lg border border-sand-border bg-surface/60 p-5">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-ink">
            How payment is protected
          </p>
          <div className="mt-3 [&_li]:border-deep-ink/15 [&_li]:text-deep-ink/60 [&_span]:text-kumkum/80">
            <PaymentMarks />
          </div>
          <p className="mt-3 font-sans text-xs leading-relaxed text-muted-ink">
            Card and UPI details are handled by the payment processor on a
            secure page and are never stored on our servers. See the{" "}
            <Link href="/disclaimer" className="underline hover:text-kumkum">
              disclaimer
            </Link>{" "}
            for the limits of that protection.
          </p>
        </section>
      </div>
    </main>
  );
}
