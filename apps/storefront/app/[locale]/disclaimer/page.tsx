import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [{ locale }, t] = await Promise.all([
    params,
    getTranslations("disclaimer"),
  ]);
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates("/disclaimer", locale),
  };
}

/**
 * The disclaimer.
 *
 * A disclaimer is only worth having if it states something the buyer did not
 * already know. So this page does not disclaim everything in sight — it says
 * exactly where a reasonable expectation could differ from what arrives, and it
 * does so before the order rather than in a footer after it.
 *
 * The clauses live in the message catalogues so Hindi and English stay in step.
 * Clause order is declared here rather than derived from the JSON, because the
 * sequence is an editorial decision — it runs from the most concrete claim to
 * the most legal — and should not silently change if a key is renamed.
 */
const CLAUSE_IDS = [
  "variation",
  "aging",
  "authenticity",
  "pricing",
  "payment",
  "culture",
  "links",
  "limitation",
] as const;

export default async function DisclaimerPage() {
  const t = await getTranslations("disclaimer");

  // Only render clauses that are fully translated. A half-translated clause
  // would print an empty paragraph, which reads as a broken page.
  const clauses = CLAUSE_IDS.filter(
    (id) => t.has(`clauses.${id}.heading`) && t.has(`clauses.${id}.p1`)
  ).map((id) => ({
    id,
    heading: t(`clauses.${id}.heading`),
    paragraphs: (["p1", "p2"] as const)
      .filter((p) => t.has(`clauses.${id}.${p}`))
      .map((p) => t(`clauses.${id}.${p}`)),
  }));

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("title") }]}
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted-ink">
          {t("updated")}
        </p>

        <div className="mt-10 space-y-10">
          {clauses.map((clause) => (
            <section
              key={clause.id}
              className="border-t border-sand-border pt-6"
            >
              <h2 className="font-serif text-xl font-semibold text-deep-ink">
                {clause.heading}
              </h2>
              <div className="mt-3 space-y-3 font-sans text-[14.5px] leading-relaxed text-muted-ink">
                {clause.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-sand-border bg-surface/70 p-5">
          <p className="font-sans text-sm leading-relaxed text-muted-ink">
            {t("footnote")}{" "}
            <a
              href="mailto:hello@snehavrinda.in"
              className="underline hover:text-kumkum"
            >
              hello@snehavrinda.in
            </a>
            .
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs">
            <li>
              <Link
                href="/policies/terms"
                className="text-muted-ink underline hover:text-kumkum"
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/policies/privacy"
                className="text-muted-ink underline hover:text-kumkum"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="text-muted-ink underline hover:text-kumkum"
              >
                FAQ
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}