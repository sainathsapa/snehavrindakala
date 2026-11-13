import { medusa } from "@/lib/medusa";
import { listCatalogue } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import { PageHeader } from "@/components/page-header";
import { PaisleyField, BotanicalRule } from "@/components/ornaments";
import { JaaliField, PaperGrain, ButiField } from "@/components/grounds";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getArtFormByQuery } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Collection",
  description:
    "Original and handmade Indian artwork — paintings, folk art, textiles, paper and wearable pieces. Every work carries the name of the artist who made it.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  // Redirect legacy query-param URLs to SEO-friendly paths (/shop?q=Folk → /shop/folk)
  if (q?.trim()) {
    const artForm = getArtFormByQuery(q.trim());
    if (artForm) {
      redirect(`/shop/${artForm.slug}`);
    }
  }

  // Live catalogue, falling back to the seed set when Medusa is empty, so the
  // shop never renders blank while the backend is only partly populated.
  const items = await listCatalogue();

  let categories: Array<{
    id: string;
    name: string;
    handle: string;
  }> = [];
  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    categories = (product_categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      handle: category.handle,
    }));
  } catch (err) {
    console.error("Failed to load product categories from Medusa", err);
  }

  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Works available now"
        title="The Collection"
        intro={`${items.length} ${items.length === 1 ? "work" : "works"} currently available. Each one is made by hand, and each listing names its maker.`}
        breadcrumb={[{ label: "Home", href: "/" }, { label: "The Collection" }]}
      />

      <section className="relative overflow-hidden pb-16 pt-10 lg:pb-24">
        <JaaliField style={{ opacity: 0.55 }} />
        <PaperGrain />
        <PaisleyField className="pointer-events-none absolute right-0 top-8 hidden h-72 w-72 text-terracotta/[0.05] lg:block" />

        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          {/* ── Filter rail ────────────────────────────────────────────────
              Kept as a plain row of quiet text links. On a gallery page the
              filters should behave like a caption line, not a toolbar. */}
          {categories.length > 0 && (
            <nav
              aria-label="Filter by collection"
              className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-sand-border/60 pb-5"
            >
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                Browse
              </span>
              <Link
                href="/art-forms"
                className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
              >
                all art forms
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/shop/${category.handle}`}
                  className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          )}

          {items.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
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
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                The collection is being refreshed. New work is on its way.
              </p>
              <Link
                href="/art-forms"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                Browse by art form
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Continue the journey ───────────────────────────────────────────
          A shop page that ends at a grid asks the visitor to judge the work with
          no context for it. These three doors offer the context — what the
          tradition is, what the materials are, and what it would take to have
          something made — which is also what turns a browser into a collector. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/50">
        <ButiField style={{ opacity: 0.3 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="py-10 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-terracotta">
            Before you choose
          </p>
          <div className="grid border-t border-sand-border/60 sm:grid-cols-3">
            {[
              {
                href: "/art-forms",
                eyebrow: "The tradition",
                title: "Where each form comes from",
              },
              {
                href: "/learn",
                eyebrow: "The materials",
                title: "What the work is made of",
              },
              {
                href: "/custom-art",
                eyebrow: "Made for you",
                title: "Have something made to order",
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
