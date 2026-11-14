import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, KalamBorder } from "@/components/ornaments";
import { ButiField, PaperGrain, JaaliField } from "@/components/grounds";

export async function generateMetadata() {
  const t = await getTranslations("about");
  return {
    title: t("crumb"),
    description: t("intro"),
    alternates: localeAlternates("/about"),
  };
};

export default function AboutPage() {
  const t = useTranslations("about");

  const principles = ["p1", "p2", "p3", "p4"] as const;
  const steps = ["s1", "s2", "s3", "s4"] as const;

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("home"), href: "/" }, { label: t("crumb") }]}
        image="/images/artforms/painting.jpg"
      />

      {/* ── Opening statement ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.5 }} />
        <PaperGrain />
        <div className="relative mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[300px_1fr] lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-6">
            <BotanicalRule className="text-terracotta" />
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {t("since")}
            </p>
          </div>
          <div className="max-w-2xl space-y-6 font-sans text-base leading-[1.8] text-muted-ink">
            <p className="font-serif text-xl leading-relaxed text-deep-ink sm:text-2xl">
              {t("lede")}
            </p>
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
          </div>
        </div>
      </section>

      {/* ── Principles ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
            {t("principlesEyebrow")}
          </p>
          <span className="mt-2 block h-px w-10 bg-terracotta/60" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-3xl font-semibold text-deep-ink sm:text-4xl">
            {t("principlesTitle")}
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((key, index) => (
              <div key={key} className="border-t border-terracotta/40 pt-5">
                <span className="font-sans text-xs font-semibold tracking-[0.2em] text-terracotta">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-serif text-xl font-semibold text-deep-ink">
                  {t(`principles.${key}.title`)}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {t(`principles.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Behind the scenes ─────────────────────────────────────────────
          A brief asks Studio to carry the creative process and the world behind
          the work, not just a mission statement. This is the room with the
          lights on: what actually happens between a brief and a finished piece,
          told as a sequence with a picture rather than four more paragraphs. */}
      <section className="relative overflow-hidden border-y border-sand-border/60 bg-surface/40 py-16 lg:py-24">
        <JaaliField style={{ opacity: 0.35 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <figure className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/60">
              <Image
                src="/images/artforms/folk.jpg"
                alt={t("behindAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </figure>

            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                {t("behindEyebrow")}
              </p>
              <h2 className="mt-3 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.01em] text-deep-ink sm:text-[40px]">
                {t("behindTitle")}
              </h2>

              <ol className="mt-8 space-y-6">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-5">
                    <span className="mt-0.5 font-serif text-lg font-semibold text-terracotta/60 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="border-l border-sand-border/70 pl-5">
                      <h3 className="font-serif text-lg font-semibold text-deep-ink">
                        {t(`steps.${step}.t`)}
                      </h3>
                      <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                        {t(`steps.${step}.d`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
      {/* ── Closing invitation ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2A120C]">
        <Image
          src="/images/artforms/textile.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2A120C] via-[#2A120C]/85 to-[#2A120C]/50" />
        <KalamBorder className="absolute inset-x-0 top-0 text-haldi/30" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <h2 className="font-serif text-3xl font-semibold leading-tight text-rang-paper sm:text-4xl">
              {t("closingTitle")}
            </h2>
            <p className="mt-3 font-sans text-small leading-relaxed text-rang-paper/80">
              {t("closingBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-rang-paper px-6 py-3 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-white"
              >
                {t("browse")}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/custom-art"
                className="inline-flex items-center gap-2 rounded-full border border-rang-paper/40 px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:border-haldi hover:text-haldi"
              >
                {t("request")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
