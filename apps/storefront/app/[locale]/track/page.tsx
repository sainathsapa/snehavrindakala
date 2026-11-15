import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { PageHeader } from "@/components/page-header";
import { TrackForm } from "./track-form";

/**
 * Track an order without signing in.
 *
 * Guest checkout is the common path here, so a buyer who closed the
 * confirmation tab had no way back to their order at all — the account page
 * shows nothing because there is no account. This page is the way back.
 *
 * It asks for the order number *and* the email used at checkout; see actions.ts
 * for why one is not enough.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "track" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates("/track"),
  };
}

export default async function TrackPage() {
  const t = await getTranslations("track");

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
      />

      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12">
        <TrackForm
          labels={{
            orderId: t("orderId"),
            orderIdHint: t("orderIdHint"),
            email: t("email"),
            emailHint: t("emailHint"),
            submit: t("submit"),
            submitting: t("submitting"),
            found: t("found"),
            status: t("status"),
            payment: t("payment"),
            placed: t("placed"),
            total: t("total"),
            items: t("items"),
            tracking: t("tracking"),
            carrier: t("carrier"),
            trackingNumber: t("trackingNumber"),
            openTracking: t("openTracking"),
            noShipment: t("noShipment"),
            viewOrder: t("viewOrder"),
            again: t("again"),
          }}
        />

        <p className="mt-10 max-w-xl font-serif text-sm italic leading-relaxed text-muted-ink">
          {t("privacyNote")}
        </p>
      </section>
    </main>
  );
}
