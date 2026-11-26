import { CommissionForm } from "@/components/commission-form";
import { localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { JaaliField, PaperGrain, ButiField } from "@/components/grounds";
import { Link } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("customArt");
  return {
    title: t("crumb"),
    description: t("intro"),
    alternates: localeAlternates("/custom-art", locale),
  };
}

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default async function CustomArtPage() {
  const t = await getTranslations("customArt");

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("home"), href: "/" }, { label: t("request") }]}
        image="/images/artforms/home-decor.jpg"
      />

      {/* ── Why commission ─────────────────────────────────────────────────
          The brief is explicit that Request must not open as 'contact us' or
          'fill this form'. Before any fields, this sets out what a commission
          actually is and who it is for — three cases, stated plainly, so the
          form below reads as a reply rather than a data entry task. */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.4 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                {t("whatEyebrow")}
              </p>
              <h2 className="mt-3 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.01em] text-deep-ink sm:text-[40px]">
                {t("whatTitle")}
              </h2>
              <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-muted-ink">
                {t("commissionDef")}
              </p>
            </div>

            <dl className="grid gap-6 sm:grid-cols-3">
              {([
                { k: "forMemory" },
                { k: "forOccasion" },
                { k: "forSpace" },
              ] as const).map(({ k }) => (
                <div key={k} className="border-t border-sand-border/70 pt-4">
                  <dt className="font-serif text-lg font-semibold text-deep-ink">
                    {t(k)}
                  </dt>
                  <dd className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                    {t(`${k}Body`)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20 pt-14 lg:pt-20">
        <JaaliField style={{ opacity: 0.45 }} />
        <PaperGrain />
        <div className="relative mx-auto grid max-w-[1400px] gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-12">
          {/* ── Process ───────────────────────────────────────────────────── */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              {t("stepsEyebrow")}
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
              {t("stepsTitle")}
            </h2>
            <BotanicalRule className="mt-6 text-terracotta" />

            <ol className="mt-10 space-y-8">
              {STEP_KEYS.map((key, index) => (
                <li key={key} className="flex gap-5">
                  <span className="mt-1 font-serif text-sm font-semibold tracking-[0.14em] text-terracotta">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="border-l border-sand-border/70 pl-5">
                    <h3 className="font-serif text-lg font-semibold text-deep-ink">
                      {t(`steps.${key}.title`)}
                    </h3>
                    <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted-ink">
                      {t(`steps.${key}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-sand-border/70 bg-surface/70 p-6 sm:p-9">
              <h2 className="font-serif text-2xl font-semibold text-deep-ink">
                {t("formTitle")}
              </h2>
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                {t("formNote")}{" "}
                anything is committed.
              </p>
              <div className="mt-7">
                <CommissionForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── {t("whileEyebrow")} ───────────────────────────────────────────────
          A form is a commitment; not everyone arriving is ready. These are the
          honest alternatives, so a visitor who is not ready to write a brief
          still has somewhere to go. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/50">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="py-10 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-terracotta">
            {t("whileEyebrow")}
          </p>
          <div className="grid border-t border-sand-border/60 sm:grid-cols-3">
            {[
              {
                href: "/art-forms",
                eyebrow: "Read first",
                title: "Which tradition suits your idea",
              },
              {
                href: "/shop",
                eyebrow: "See the standard",
                title: "What the finished work looks like",
              },
              {
                href: "/about",
                eyebrow: "Meet the makers",
                title: "Who would actually make it",
              },
            ].map((door, i) => (
              <Link
                key={door.href}
                href={door.href}
                className={`group flex flex-col justify-between gap-8 px-1 py-9 transition-colors hover:bg-surface sm:px-7 ${
                  i > 0 ? "border-t border-sand-border/60 sm:border-l sm:border-t-0" : ""
                }`}
              >
                <div>
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-ink/70">
                    {door.eyebrow}
                  </p>
                  <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                    {door.title}
                  </h3>
                </div>
                <span
                  aria-hidden="true"
                  className="text-lg text-terracotta transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
