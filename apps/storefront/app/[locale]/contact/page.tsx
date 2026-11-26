import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { ContactForm } from "@/components/contact-form";
import { AmbiRule, PulliGrid } from "@/components/learn/motifs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("contact");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates("/contact", locale),
  };
}

/**
 * Where to reach the studio.
 *
 * Every one of these lines is a legal disclosure as much as a convenience: an
 * Indian shop is expected to publish who it is, where it is, how to telephone it
 * and how to complain. The Zoho chat answers quick questions; this page exists
 * for the ones that need a record.
 */
const STUDIO = {
  name: "SnehaVrinda Kala",
  street: "Nokha Road",
  area: "Bikaner",
  region: "Rajasthan",
  postal: "334801",
  country: "India",
  phone: "+91 96767 53138",
  phoneHref: "tel:+919676753138",
  email: "hello@snehavrinda.in",
  website: "https://www.snehavrinda.in",
  hours: "Monday to Saturday, 10:00–18:00 IST",
};

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <main className="bg-rang-paper">
      <section className="relative overflow-hidden border-b border-sand-border">
        <PulliGrid className="pointer-events-none absolute inset-0 h-full w-full text-deep-ink/[0.06]" />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-sindoor">
            {t("kicker")}
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.05] text-deep-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl font-sans text-base leading-relaxed text-muted-ink">
            {t("intro")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          {/* ── the form ────────────────────────────────────────────── */}
          <div id="form" className="scroll-mt-24">
            <h2 className="font-serif text-2xl text-deep-ink">{t("formHeading")}</h2>
            <p className="mt-2 max-w-lg font-sans text-sm leading-relaxed text-muted-ink">
              {t("formBody")}
            </p>
            <ContactForm />
          </div>

          {/* ── the studio ──────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border-t border-sand-border pt-5">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink">
                {t("studioHeading")}
              </h2>
              <address className="mt-3 font-serif text-[15px] not-italic leading-relaxed text-deep-ink">
                {STUDIO.name}
                <br />
                {STUDIO.street}
                <br />
                {STUDIO.area}, {STUDIO.region} {STUDIO.postal}
                <br />
                {STUDIO.country}
              </address>

              <dl className="mt-6 space-y-3 font-sans text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-ink">
                    {t("emailLabel")}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`mailto:${STUDIO.email}`}
                      className="text-sindoor underline-offset-4 hover:underline"
                    >
                      {STUDIO.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-ink">
                    {t("phoneLabel")}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={STUDIO.phoneHref}
                      className="text-sindoor underline-offset-4 hover:underline"
                    >
                      {STUDIO.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-ink">
                    {t("hoursLabel")}
                  </dt>
                  <dd className="mt-0.5 text-muted-ink">{STUDIO.hours}</dd>
                </div>
              </dl>
            </div>

            <AmbiRule className="mt-8 h-5 w-full text-sindoor/25" />

            <div className="mt-6 border-t border-sand-border pt-5">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink">
                {t("fasterHeading")}
              </h2>
              <ul className="mt-3 space-y-2 font-sans text-sm">
                <li>
                  <Link href="/track" className="text-muted-ink hover:text-sindoor">
                    {t("fasterTracking")}
                  </Link>
                </li>
                <li>
                  <Link href="/policies/returns" className="text-muted-ink hover:text-sindoor">
                    {t("fasterDamaged")}
                  </Link>
                </li>
                <li>
                  <Link href="/custom-art" className="text-muted-ink hover:text-sindoor">
                    {t("fasterCommission")}
                  </Link>
                </li>
                <li>
                  <Link href="/learn" className="text-muted-ink hover:text-sindoor">
                    {t("fasterLearn")}
                  </Link>
                </li>
              </ul>
            </div>

            <p className="mt-8 border-l-2 border-sindoor/30 pl-4 font-serif text-[13px] italic leading-relaxed text-deep-ink/75">
              {t("grievance")}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
