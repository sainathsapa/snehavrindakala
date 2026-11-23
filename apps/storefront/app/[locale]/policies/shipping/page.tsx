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
    title: t("shippingTitle"),
    description: t("shippingIntro"),
    alternates: localeAlternates("/policies/shipping", locale),
  };
}

export default async function ShippingPolicyPage() {
  const t = await getTranslations("policies");

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-6">
          {t("shippingTitle")}
        </h1>
        <div className="space-y-6 text-muted font-sans leading-relaxed">
          <p>{t("shippingIntro")}</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>{t("shippingReady")}</strong> {t("shippingReadyBody")}
            </li>
            <li>
              <strong>{t("shippingMade")}</strong> {t("shippingMadeBody")}
            </li>
            <li>
              <strong>{t("shippingCustom")}</strong> {t("shippingCustomBody")}
            </li>
          </ul>
          <p>{t("shippingOutro")}</p>
        </div>
      </div>
    </main>
  );
}
