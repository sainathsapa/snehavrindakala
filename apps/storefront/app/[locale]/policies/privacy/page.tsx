import { getTranslations } from "next-intl/server";

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("policies");

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          {t("privacyTitle")}
        </h1>
        <div className="space-y-6 text-muted font-sans leading-relaxed">
          <p>{t("privacyP1")}</p>
          <p>{t("privacyP2")}</p>
          <p>{t("privacyP3")}</p>
          <p>{t("privacyP4")}</p>
        </div>
      </div>
    </main>
  );
}
