import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { listArtForms } from "@/lib/site-content";
import { listCatalogueFor } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule, KalamBorder, MandalaField } from "@/components/ornaments";
import { medusa } from "@/lib/medusa";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Renders the admin-written long-form story.
 *
 * The body is authored as plain text with `**bold**` spans and blank-line
 * paragraph breaks — deliberately not raw HTML, so an admin cannot inject
 * markup into a public page. Everything is escaped by React.
 */
function StoryBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-6 font-sans text-base leading-[1.85] text-muted-ink">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={i} className="font-semibold text-deep-ink">
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              <span key={i}>{chunk}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = (await params) ?? {};
  if (!slug) return { title: "SnehaVrinda Kala" };

  const forms = await listArtForms().catch(() => []);
  const form = forms.find((f) => f.slug === slug);

  if (!form) return { title: "Art form not found" };

  return {
    title: form.name,
    description: form.description || form.story?.slice(0, 160),
    alternates: { canonical: `/art-forms/${form.slug}` },
    openGraph: {
      title: form.name,
      description: form.description,
      images: form.image ? [form.image] : undefined,
    },
  };
}

export default async function ArtFormPage({ params }: PageProps) {
  const { slug } = (await params) ?? {};
  if (!slug) notFound();

  const forms = await listArtForms().catch(() => []);
  const form = forms.find((f) => f.slug === slug);
  if (!form) notFound();

  // The works in this tradition. The catalogue resolves aliases internally, but
  // it matches on any of the keys given, so pass the slug *and* the display name
  // (a seeded "Home & Decorative Art" category and the "home-decor" taxonomy
  // entry are the same collection under two spellings).
  const items = await listCatalogueFor([slug, form.name, form.slug]).catch(() => []);

  const others = forms.filter((f) => f.slug !== slug).slice(0, 3);

  const baseUrl = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Art Forms", item: `${baseUrl}/art-forms` },
      { "@type": "ListItem", position: 3, name: form.name, item: `${baseUrl}/art-forms/${form.slug}` },
    ],
  };

  return (
    <main className="bg-rang-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <PageHeader
        eyebrow={form.origin || "Tradition"}
        title={form.name}
        intro={form.description}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Art Forms", href: "/art-forms" },
          { label: form.name },
        ]}
        image={form.image || undefined}
      />

      {/* ── The story ────────────────────────────────────────────────────── */}
      {form.story && (
        <section className="relative overflow-hidden border-b border-sand-border/60 py-16 lg:py-24">
          <MandalaField className="pointer-events-none absolute -right-24 top-16 hidden h-80 w-80 text-terracotta/[0.05] lg:block" />

          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[260px_1fr] lg:gap-20">
              {/* Marginalia: the facts, set as a museum label would set them. */}
              <aside className="lg:sticky lg:top-28 lg:self-start">
                <BotanicalRule className="text-terracotta" />
                <dl className="mt-8 space-y-6">
                  {form.origin && (
                    <div>
                      <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                        Origin
                      </dt>
                      <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                        {form.origin}
                      </dd>
                    </div>
                  )}
                  {form.materials && (
                    <div>
                      <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                        Materials
                      </dt>
                      <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                        {form.materials}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                      Works available
                    </dt>
                    <dd className="mt-1.5 font-serif text-sm leading-relaxed text-deep-ink">
                      {items.length > 0 ? `${items.length} in the collection` : "None just now"}
                    </dd>
                  </div>
                </dl>

                {items.length > 0 && (
                  <Link
                    href={`/shop/${form.slug}`}
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                  >
                    See the works
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </aside>

              <div className="max-w-2xl">
                {form.quote && (
                  <blockquote className="mb-10 border-l-2 border-terracotta/50 pl-6">
                    <p className="font-serif text-xl italic leading-relaxed text-deep-ink sm:text-2xl">
                      {form.quote}
                    </p>
                  </blockquote>
                )}
                <StoryBody text={form.story} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Works in this tradition ──────────────────────────────────────── */}
      {items.length > 0 && (
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-sand-border/60 pb-5">
              <h2 className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
                Works in this tradition
              </h2>
              <Link
                href={`/shop/${form.slug}`}
                className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
              >
                view all →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {items.slice(0, 4).map((item) => (
                <ProductCard
                  key={item.handle}
                  handle={item.handle}
                  title={item.title}
                  artist={item.artist}
                  price={item.price}
                  stockType={item.stockType}
                  image={item.image}
                  isNew={item.isNew}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Other traditions ─────────────────────────────────────────────── */}
      {others.length > 0 && (
        <section className="relative overflow-hidden bg-[#2A120C] py-16">
          <KalamBorder className="absolute inset-x-0 top-0 text-haldi/30" />
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
            <h2 className="font-serif text-2xl font-semibold text-rang-paper sm:text-3xl">
              Keep looking
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {others.map((other) => (
                <Link key={other.slug} href={`/art-forms/${other.slug}`} className="group">
                  <div className="relative aspect-[4/3] overflow-hidden ring-1 ring-rang-paper/20">
                    {other.image ? (
                      <Image
                        src={other.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-opacity duration-500 group-hover:opacity-80"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#3a1a12]" />
                    )}
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-semibold text-rang-paper transition-colors group-hover:text-haldi">
                    {other.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
