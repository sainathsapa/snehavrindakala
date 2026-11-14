import Link from "next/link";
import { localeAlternates } from "@/lib/seo";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { BelButi, MithilaBorder, LotusRosette } from "@/components/indian-motifs";
import { PlateNumber } from "@/components/editorial";
import { ButiField, PaperGrain } from "@/components/grounds";
import { listJournalPosts, type JournalListItem } from "@/lib/journal";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("journal");
  return {
    title: t("crumb"),
    description: t("intro"),
    alternates: localeAlternates("/journal"),
  };
}

export const dynamic = "force-dynamic";

/**
 * The journal reads as the back matter of a catalogue: one lead essay given a
 * plate and a wide column, then the rest as entries in a printed index. A grid
 * of equal cards would make six very different essays look interchangeable.
 */
export default async function JournalPage() {
  const t = await getTranslations("journal");
  const locale = await getLocale();
  let posts: JournalListItem[] = [];

  try {
    posts = await listJournalPosts(50, locale);
  } catch (error) {
    console.error("Failed to load journal posts", error);
  }

  const [lead, ...rest] = posts;

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        breadcrumb={[{ label: t("home"), href: "/" }, { label: t("crumb") }]}
      />

      {posts.length === 0 ? (
        <section className="pb-24">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center px-5 py-20 text-center sm:px-8 lg:px-12">
            <LotusRosette className="mb-6 h-20 w-20 text-terracotta/30" />
            <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
              {t("emptyTitle")}
            </p>
            <p className="mt-2 font-sans text-sm text-muted-ink">
              {t("emptyBody")}
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* ── Lead essay ────────────────────────────────────────────────── */}
          {lead && (
            <section className="relative overflow-hidden pb-16 lg:pb-24">
              <BelButi className="pointer-events-none absolute -right-4 top-0 hidden h-20 w-48 text-terracotta/[0.12] lg:block" />
              <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
                <PlateNumber number={1} label="Lead essay" className="mb-8" />

                <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
                  <Link href={`/journal/${lead.slug}`} className="group block">
                    {lead.cover_image && (
                      <div className="relative aspect-[4/3] overflow-hidden bg-surface ring-1 ring-sand-border/60">
                        <Image
                          src={lead.cover_image}
                          alt=""
                          fill
                          priority
                          sizes="(max-width: 1024px) 100vw, 55vw"
                          className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                        />
                      </div>
                    )}
                  </Link>

                  <div>
                    {lead.author && (
                      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-terracotta">
                        {lead.author}
                      </p>
                    )}
                    <Link href={`/journal/${lead.slug}`}>
                      <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.12] tracking-[-0.01em] text-deep-ink transition-colors hover:text-kumkum sm:text-4xl lg:text-[42px]">
                        {lead.title}
                      </h2>
                    </Link>
                    {lead.excerpt && (
                      <p className="mt-5 max-w-lg font-serif text-lg italic leading-relaxed text-muted-ink">
                        {lead.excerpt}
                      </p>
                    )}
                    <MithilaBorder className="mt-7 h-3 w-40 text-terracotta/30" />
                    <Link
                      href={`/journal/${lead.slug}`}
                      className="mt-7 inline-flex items-center gap-2 font-sans text-sm font-medium text-kumkum transition-colors hover:text-sindoor"
                    >
                      {t("readEssay")}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── The index ─────────────────────────────────────────────────── */}
          {rest.length > 0 && (
            <section className="relative overflow-hidden border-t border-sand-border/60 py-16 lg:py-24">
              {/* A block-print ground behind the archive. A long list of titles
                  on a flat field reads as a database; on printed cloth it reads
                  as a catalogue. */}
              <ButiField style={{ opacity: 0.6 }} />
              <PaperGrain />
              <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
                <PlateNumber number={2} label="Earlier entries" className="mb-10" />

                <ul className="divide-y divide-sand-border/60">
                  {rest.map((post, index) => {
                    const date = post.published_at ?? post.created_at;
                    return (
                      <li key={post.id}>
                        <Link
                          href={`/journal/${post.slug}`}
                          className="group grid gap-4 py-7 sm:grid-cols-[auto_auto_1fr_auto] sm:items-center sm:gap-6"
                        >
                          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-terracotta/70 tabular-nums">
                            {String(index + 2).padStart(2, "0")}
                          </span>

                          {/* A small plate per entry. Text-only rows made the
                              archive read as a database; one image per story
                              restores the catalogue feeling without turning
                              the list into a card grid. */}
                          {post.cover_image ? (
                            <span className="relative hidden h-16 w-24 shrink-0 overflow-hidden bg-surface ring-1 ring-sand-border/50 sm:block">
                              <Image
                                src={post.cover_image}
                                alt=""
                                aria-hidden="true"
                                fill
                                sizes="96px"
                                className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                              />
                            </span>
                          ) : (
                            <span
                              aria-hidden="true"
                              className="hidden h-16 w-24 shrink-0 border border-sand-border/50 sm:block"
                            />
                          )}

                          <span className="min-w-0">
                            <span className="block font-serif text-xl font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum sm:text-2xl">
                              {post.title}
                            </span>
                            {post.excerpt && (
                              <span className="mt-1.5 block max-w-2xl font-sans text-sm leading-relaxed text-muted-ink">
                                {post.excerpt}
                              </span>
                            )}
                          </span>

                          <span className="shrink-0 font-sans text-[11px] uppercase tracking-[0.18em] text-muted-ink/70">
                            {new Date(date).toLocaleDateString("en-IN", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
