import { Link } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, SectionIntro, ArrowLink } from "@/components/ornaments";
import { ButiField, PaperGrain } from "@/components/grounds";
import { listTestimonials } from "@/lib/site-content";


export async function generateMetadata() {
  const t = await getTranslations("authenticity");
  return {
    title: t("crumb"),
    description: t("intro"),
    alternates: localeAlternates("/authenticity"),
  };
}

// Reads testimonials from Postgres, so it must not be frozen at build time —
// otherwise a quote added in the admin never appears here.
export const dynamic = "force-dynamic";

/**
 * The page that answers the objection every serious art buyer has.
 *
 * A premium handmade piece asks someone to spend real money on an object they
 * cannot touch. The thing standing in the way is not price, it is doubt: is this
 * actually handmade, is it actually what it claims, and what happens if it
 * arrives wrong. This page answers those three directly rather than with a
 * badge, because a claim of authenticity that is only a graphic is worth
 * nothing.
 */

const ASSURANCE_KEYS = ["a1", "a2", "a3", "a4", "a5", "a6"] as const;

const WILL_NOT_KEYS = ["w1", "w2", "w3"] as const;

export default async function AuthenticityPage() {
  const locale = await getLocale();

  const t = await getTranslations("authenticity");
  const testimonials = await listTestimonials();

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("home"), href: "/" }, { label: t("crumb") }]}
        image="/images/artforms/painting.jpg"
      />

      {/* ── The six assurances ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.4 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ASSURANCE_KEYS.map((key, index) => (
              <article
                key={key}
                className="relative border-t border-sand-border/70 pt-5"
              >
                <span className="font-serif text-sm text-terracotta">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-1 font-serif text-xl text-deep-ink">
                  {t(`assurances.${key}.title`)}
                </h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                  {t(`assurances.${key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What we refuse to do ───────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-sand-border/60 bg-surface/40 py-14 lg:py-20">
        <div className="relative mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[300px_1fr] lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-6">
            <BotanicalRule className="text-terracotta" />
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {t("linesEyebrow")}
            </p>
          </div>
          <div className="max-w-2xl">
            <ul className="space-y-4">
              {WILL_NOT_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex gap-4 border-b border-sand-border/60 pb-4 font-sans text-base leading-relaxed text-deep-ink"
                >
                  <span aria-hidden="true" className="text-terracotta">
                    —
                  </span>
                  {t(`willNot.${key}`)}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-sans text-sm leading-relaxed text-muted-ink">
              {t("mailPre")}{" "}
              <a
                className="text-terracotta underline decoration-sand-border underline-offset-4 hover:decoration-terracotta"
                href="mailto:hello@snehavrinda.in"
              >
                hello@snehavrinda.in
              </a>{" "}
              {t("mailPost")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Buyer words, straight from the database ────────────────────── */}
      {testimonials.length > 0 && (
        <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
          <PaperGrain />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <SectionIntro
              eyebrow={t("wordsEyebrow")}
              title={t("wordsTitle")}
              align="center"
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {testimonials.map((t) => (
                <figure
                  key={t.id}
                  className="border-t border-sand-border/70 pt-5"
                >
                  <blockquote className="font-serif text-lg leading-relaxed text-deep-ink">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-3 font-sans text-xs uppercase tracking-[0.16em] text-muted-ink">
                    {t.author}
                    {t.location ? ` · ${t.location}` : ""}
                    {t.work ? ` · ${t.work}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Close ──────────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 sm:grid-cols-3">
            <ArrowLink href="/policies/shipping">{t("ship")}</ArrowLink>
            <ArrowLink href="/policies/returns">{t("returns")}</ArrowLink>
            <ArrowLink href="/custom-art">{t("commission")}</ArrowLink>
          </div>
        </div>
      </section>
    </main>
  );
}
