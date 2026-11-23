import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [{ locale }, t] = await Promise.all([
    params,
    getTranslations("policies"),
  ]);
  return {
    title: t("returnsTitle"),
    description: t("returnsIntro"),
    alternates: localeAlternates("/policies/returns", locale),
  };
}

export default async function ReturnsPolicyPage() {
  const t = await getTranslations("policies");

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          {t("returnsTitle")}
        </h1>
        <div className="space-y-6 text-muted font-sans leading-relaxed">
          <p>{t("returnsIntro")}</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>{t("returnsReady")}</strong> {t("returnsReadyBody")}
            </li>
            <li>
              <strong>{t("returnsMade")}</strong> {t("returnsMadeBody")}
            </li>
            <li>
              <strong>{t("returnsCustom")}</strong> {t("returnsCustomBody")}
            </li>
            <li>
              <strong>{t("returnsDamaged")}</strong> {t("returnsDamagedBody")}
            </li>
          </ul>
          <p>{t("returnsOutro")}</p>
        </div>
      </div>
    </main>
  );
}
