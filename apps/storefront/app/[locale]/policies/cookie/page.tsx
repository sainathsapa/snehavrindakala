import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { CookieSettingsButton } from "@/components/analytics-consent";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [{ locale }, t] = await Promise.all([
    params,
    getTranslations("cookiePolicy"),
  ]);
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates("/policies/cookie", locale),
  };
}

const SECTION_IDS = [
  "essential",
  "analytics",
  "choices",
  "thirdParties",
  "changes",
] as const;

/**
 * Cookie and consent notice.
 *
 * The copy is intentionally general and does not name a legal entity, a
 * grievance officer, or a regulator: those details have to come from the
 * studio, not from a template. The "under review" note is visible on the page
 * so nobody mistakes this for a completed, legally reviewed notice.
 */
export default async function CookiePolicyPage() {
  const t = await getTranslations("cookiePolicy");

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("title") }]}
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <p
          role="note"
          className="rounded-lg border border-haldi/40 bg-haldi/10 px-4 py-3 font-sans text-[13px] leading-relaxed text-deep-ink"
        >
          <strong className="font-semibold">{t("reviewLabel")}:</strong>{" "}
          {t("reviewNote")}
        </p>

        <div className="mt-10 space-y-10">
          {SECTION_IDS.map((id) => (
            <section
              key={id}
              id={id}
              className="scroll-mt-28 border-t border-sand-border pt-6"
            >
              <h2 className="font-serif text-xl font-semibold text-deep-ink">
                {t(`sections.${id}.heading`)}
              </h2>
              <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-muted-ink">
                {t(`sections.${id}.body`)}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-sand-border bg-surface/70 p-5">
          <p className="font-sans text-sm leading-relaxed text-muted-ink">
            {t("manageIntro")}
          </p>
          {GA_MEASUREMENT_ID && (
            <CookieSettingsButton className="mt-4 inline-flex rounded-full bg-kumkum px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor" />
          )}
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs">
            <li>
              <Link
                href="/policies/privacy"
                className="text-muted-ink underline hover:text-kumkum"
              >
                {t("privacyLink")}
              </Link>
            </li>
            <li>
              <Link
                href="/policies/terms"
                className="text-muted-ink underline hover:text-kumkum"
              >
                {t("termsLink")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
