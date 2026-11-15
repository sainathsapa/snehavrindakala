import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { PaymentMarks } from "@/components/payment-marks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("faq");
  return { title: t("title"), description: t("intro") };
}

/**
 * The questions buyers actually ask.
 *
 * Written as answers, not as a policy restatement. Where a real constraint
 * exists — an artwork is one of one, customs duty is the buyer's — it says so
 * plainly rather than burying it, because a surprise at delivery costs more
 * trust than a clear sentence here.
 *
 * The copy lives in the message catalogues rather than here so the Hindi and
 * English versions cannot drift: both are keyed off the same section and
 * question ids, and a missing key fails loudly at build time instead of
 * silently rendering English inside a Hindi page.
 */
const SECTION_IDS = ["buying", "shipping", "returns", "payments"] as const;

/** Question numbers, in order, for each section. */
const QUESTIONS = ["1", "2", "3", "4"] as const;

const CONTACT_KEYS = ["write", "commission", "track", "shipping", "returns"] as const;

const CONTACT_HREFS: Record<(typeof CONTACT_KEYS)[number], string> = {
  write: "mailto:hello@snehavrinda.in",
  commission: "/custom-art",
  track: "/account",
  shipping: "/policies/shipping",
  returns: "/policies/returns",
};

export default async function FaqPage() {
  const t = await getTranslations("faq");

  // Build the section list from the catalogue. A section renders only the
  // questions that actually have both a question and an answer translated —
  // that way a partially translated locale shows fewer questions rather than
  // an empty definition list or an English sentence in the middle of Hindi.
  const sections = SECTION_IDS.map((id) => {
    const items = QUESTIONS.flatMap((n) => {
      const qKey = `sections.${id}.q${n}`;
      const aKey = `sections.${id}.a${n}`;
      if (!t.has(qKey) || !t.has(aKey)) return [];
      return [{ q: t(qKey), a: t(aKey) }];
    });
    return {
      id,
      heading: t(`sections.${id}.heading`),
      items,
    };
  }).filter((section) => section.items.length > 0);

  return (
    <main className="bg-rang-paper">
      {/* FAQPage built from the same `sections` the page renders, so the markup
          and the structured data can never disagree. A question that is not
          translated into the current locale is already excluded above, which
          means a Hindi FAQ advertises Hindi questions — not an English set with
          a Hindi URL. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: sections.flatMap((section) =>
              section.items.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              }))
            ),
          }),
        }}
      />
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("title") }]}
      />

      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
        <nav aria-label={t("title")} className="mb-12 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-sand-border px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink transition-colors hover:border-kumkum hover:text-kumkum"
            >
              {section.heading}
            </a>
          ))}
        </nav>

        <div className="space-y-14">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
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
            {t("stillNeed")}
          </h2>
          <p className="mt-2 max-w-2xl font-sans text-[14.5px] leading-relaxed text-muted-ink">
            {t("stillNeedBody")}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CONTACT_KEYS.map((key) => (
              <li key={key}>
                <Link
                  href={CONTACT_HREFS[key]}
                  className="group flex h-full flex-col justify-between rounded-lg border border-sand-border bg-surface/70 p-4 transition-colors hover:border-kumkum"
                >
                  <span className="font-serif text-base font-semibold text-deep-ink transition-colors group-hover:text-kumkum">
                    {t(`contact.${key}`)}
                  </span>
                  <span className="mt-1.5 font-sans text-xs leading-relaxed text-muted-ink">
                    {t(`contact.${key}Detail`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-lg border border-sand-border bg-surface/60 p-5">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-ink">
            {t("paymentProtected")}
          </p>
          <div className="mt-3 [&_li]:border-deep-ink/15 [&_li]:text-deep-ink/60 [&_span]:text-kumkum/80">
            <PaymentMarks />
          </div>
        </section>
      </div>
    </main>
  );
}
