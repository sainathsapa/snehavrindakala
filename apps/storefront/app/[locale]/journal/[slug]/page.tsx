import { Link } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { BelButi, MithilaBorder } from "@/components/indian-motifs";
import { PaintedRule } from "@/components/editorial";
import { ButiField, PaperGrain } from "@/components/grounds";
import {
  getJournalPost,
  listJournalPosts,
  type JournalListItem,
  type JournalPost,
} from "@/lib/journal";
import { listArtForms } from "@/lib/site-content";

// Left dynamic: the root layout reads `headers()` to resolve the locale,
// which makes every route under it request-scoped, so `revalidate` alone
// cannot produce a cached render. Converting these routes to ISR needs the
// locale to come from `params` instead of a request header — a change to the
// layout that affects every page, and therefore out of scope for this phase.
// Recorded here so the next attempt does not repeat the mistake of adding
// `revalidate` and assuming it took effect: verify with the build output,
// where an ISR route prints ● and a dynamic one prints ƒ.
export const dynamic = "force-dynamic";

/**
 * Renders an essay body.
 *
 * Content is authored as plain text with `**bold**` spans and blank-line
 * paragraphs — deliberately not HTML, so an admin cannot inject markup into a
 * public page and nothing has to be sanitised. React escapes everything.
 */
function EssayBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  const render = (raw: string) =>
    raw
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((chunk, i) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? (
          <strong key={i} className="font-semibold text-deep-ink">
            {chunk.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{chunk}</span>
        )
      );

  return (
    <div className="space-y-6 font-serif text-[1.0625rem] leading-[1.85] text-muted-ink sm:text-lg">
      {paragraphs.map((paragraph, index) => {
        const first = paragraph.replace(/\*\*/g, "").charAt(0);
        return (
          <p key={index}>
            {index === 0 && (
              <>
                <span
                  className="float-left mr-2 mt-1 font-serif text-[3.2rem] font-semibold leading-[0.78] text-kumkum"
                  aria-hidden="true"
                >
                  {first}
                </span>
                {/* Keep the screen reader reading the whole word, not the
                    ornate initial in isolation. */}
                <span className="sr-only">{first}</span>
              </>
            )}
            {render(index === 0 ? paragraph.replace(/\*\*/g, "").slice(1) : paragraph)}
          </p>
        );
      })}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const post = await getJournalPost(slug, await getLocale());
    if (post) {
      return {
        title: post.title,
        description: post.excerpt ?? undefined,
        alternates: localeAlternates(`/journal/${post.slug}`),
        openGraph: {
          title: post.title,
          description: post.excerpt ?? undefined,
          type: "article",
          images: post.cover_image ? [post.cover_image] : undefined,
        },
      };
    }
  } catch {
    // Fall through to the generic metadata rather than failing the page.
  }
  return { title: "Journal" };
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();

  let post: JournalPost | null = null;
  let related: JournalListItem[] = [];

  try {
    // Straight from Postgres: this is a server component talking to its own
    // database, so `fetch()`ing the public API would only add a slow, fragile
    // round trip through the hostname.
    post = await getJournalPost(slug, locale);
    related = (await listJournalPosts(50, locale))
      .filter((item) => item.slug !== slug)
      .slice(0, 3);
  } catch (error) {
    console.error("Failed to load journal post", error);
  }

  if (!post) {
    notFound();
  }

  // The art-form label beside the author was a hard-coded English map, so an
  // essay read in Hindi still named its tradition in English. The admin-managed
  // rows already carry both names; read them instead of restating them here.
  const artFormName = await listArtForms(locale)
    .then((rows) => rows.find((row) => row.slug === post?.art_form)?.name)
    .catch(() => undefined);

  const published =
    post.published_at ?? post.created_at;

  // The origin is needed for the fully-qualified URLs schema.org requires; a
  // relative one silently invalidates the graph.
  const siteOrigin = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const postUrl = `${siteOrigin}/journal/${post.slug}`;

  return (
    <main className="bg-rang-paper">
      {/* BlogPosting, not Article: this is a dated, authored editorial piece on a
          blog path, which is the shape Google expects for an essay. Author and
          datePublished come from the stored record — nothing is inferred, and
          fields that are genuinely absent are omitted rather than filled with a
          placeholder. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt ?? undefined,
            url: postUrl,
            mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
            ...(post.cover_image ? { image: [`${siteOrigin}${post.cover_image}`] } : {}),
            ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
            ...(published ? { datePublished: new Date(published).toISOString() } : {}),
            publisher: {
              "@type": "Organization",
              name: "SnehaVrinda Kala",
              url: siteOrigin,
            },
            inLanguage: locale,
          }),
        }}
      />
      <PageHeader
        eyebrow="Journal"
        title={post.title}
        intro={post.excerpt ?? undefined}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Journal", href: "/journal" },
          { label: post.title },
        ]}
      />

      {post.cover_image && (
        <div className="relative mx-auto max-w-[1100px] px-5 sm:px-8 lg:px-12">
          <div className="relative aspect-[16/9] overflow-hidden bg-surface ring-1 ring-sand-border/60">
            <Image
              src={post.cover_image}
              alt=""
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1100px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <article className="relative mx-auto max-w-[1400px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <BelButi className="pointer-events-none absolute right-0 top-0 h-24 w-40 text-terracotta/[0.10] lg:block" />

        <div className="relative grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20">
          {/* Marginalia: how a printed essay is set. */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <dl className="space-y-5">
              <div>
                <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
                  Published
                </dt>
                <dd className="mt-1 font-serif text-sm text-deep-ink">
                  <time dateTime={published}>
                    {new Date(published).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </dd>
              </div>
              {post.author && (
                <div>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
                    Written by
                  </dt>
                  <dd className="mt-1 font-serif text-sm text-deep-ink">
                    {post.author}
                  </dd>
                </div>
              )}
              {/* The tradition this essay is about, carried in the marginalia
                  the way a printed essay names its subject. Present only when
                  the post is about one tradition — the kolam piece is about a
                  practice, not an art form, and gets no row. */}
              {post.art_form && (
                <div>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
                    Tradition
                  </dt>
                  <dd className="mt-1 font-serif text-sm">
                    <Link
                      href={`/art-forms/${post.art_form}`}
                      className="text-deep-ink underline decoration-terracotta/40 underline-offset-4 transition-colors hover:text-kumkum"
                    >
                      {artFormName ?? post.art_form}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <MithilaBorder className="mt-8 h-3 w-28 text-terracotta/30" />
          </aside>

          <div className="max-w-2xl">
            {post.content ? (
              <EssayBody text={post.content} />
            ) : (
              <p className="font-serif text-lg italic text-muted-ink">
                This piece is still being written.
              </p>
            )}

            <PaintedRule className="mt-14" />

            {/* A brief is specific that an article should connect back into the
                ecosystem rather than just expiring. This is the thread: the
                essay ends, and the reading continues into the tradition that
                made the subject possible. */}
            <div className="mt-10 border border-sand-border/70 bg-surface/60 p-6">
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                Go deeper
              </p>
              <p className="mt-2 font-serif text-lg leading-snug text-deep-ink">
                The traditions behind this story have their own pages — where
                they came from, what they are made of, and how they are still
                being made.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <Link
                  href="/art-forms"
                  className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta transition-colors hover:text-kumkum"
                >
                  All traditions →
                </Link>
                <Link
                  href="/learn"
                  className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta transition-colors hover:text-kumkum"
                >
                  The glossary →
                </Link>
                <Link
                  href="/shop"
                  className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta transition-colors hover:text-kumkum"
                >
                  Works for sale →
                </Link>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/journal"
                className="font-sans text-sm font-medium text-kumkum transition-colors hover:text-sindoor"
              >
                ← All stories
              </Link>
              <Link
                href="/art-forms"
                className="font-sans text-sm font-medium text-kumkum transition-colors hover:text-sindoor"
              >
                Explore the traditions →
              </Link>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="relative overflow-hidden border-t border-sand-border/60 py-16 lg:py-20">
          <ButiField style={{ opacity: 0.4 }} />
          <PaperGrain />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <h2 className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
              More from the journal
            </h2>
            <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link key={item.id} href={`/journal/${item.slug}`} className="group block">
                  {item.cover_image && (
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                      <Image
                        src={item.cover_image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                      />
                    </div>
                  )}
                  <h3 className="mt-3 border-t border-sand-border/60 pt-3 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                    {item.title}
                  </h3>
                  {item.excerpt && (
                    <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted-ink line-clamp-2">
                      {item.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
