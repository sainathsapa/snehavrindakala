import { Link } from "@/i18n/routing";
import { Icon } from "@snehavrinda-kala/ui";
import { universalSearch, type SearchResult } from "@/lib/search";
import { artFormSlugs } from "@/lib/slugs";
import { getTranslations, getLocale } from "next-intl/server";
import { productTranslationsFor } from "@/lib/site-content";
import { PeacockMark } from "@/components/grounds";
import { logSearch } from "@/lib/search-log";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = (q || "").trim();
  const locale = await getLocale();
  const t = await getTranslations("searchPage");

  let results: SearchResult[] = [];
  let count = 0;
  let failed = false;

  if (query) {
    try {
      // A hard ceiling on the whole search. Each Medusa call has its own
      // timeout, but this page is force-dynamic and renders on every request:
      // if the store API is unreachable, the visitor must still get the page
      // and its "nothing found" state rather than a hanging tab.
      const data = await Promise.race([
        universalSearch(query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("search timed out")), 6000)
        ),
      ]);
      results = data.results;
      count = data.count;

      // Medusa returns the English title and description, and search reads it
      // directly rather than through the catalogue cache. Without this overlay
      // a Hindi search showed Hindi chrome above English result cards.
      const locale = await getLocale();
      if (locale !== "en") {
        const translations = await productTranslationsFor(locale);
        results = results.map((r) => {
          if (r.type !== "product" || !r.handle) return r;
          const tr = translations.get(r.handle);
          if (!tr) return r;
          return {
            ...r,
            title: tr.title || r.title,
            description: tr.description || r.description,
          };
        });
      }
    } catch (error) {
      console.error("Failed to load search results", error);
      failed = true;
    }
  }

  // A search that finds nothing is the most useful thing this page ever learns:
  // somebody just said what they wanted to buy and the shop could not answer.
  // Recorded after the results are known, and never allowed to break the page.
  if (query) {
    await logSearch(query, locale, failed ? 0 : results.length);
  }

  const typeIcons: Record<string, string> = {
    product: "products",
    category: "categories",
    artist: "partners",
    room: "home",
    story: "journal",
  };

  return (
    <main className="relative overflow-hidden py-10">
      <PeacockMark className="absolute -right-10 top-2 hidden h-56 w-56 lg:block" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm font-sans">
          <Link
            href="/shop"
            className="text-muted-ink hover:text-sindoor transition-colors"
          >
            {t("backToShop")}
          </Link>
        </nav>

        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight mb-2">
          {query ? t("resultsFor", { query }) : t("search")}
        </h1>
        {query && !failed && (
          <p className="mb-8 text-sm text-muted-ink font-sans">
            {t(count === 1 ? "resultOne" : "resultMany", { count })}
          </p>
        )}

        {/* An empty query is a normal entry point, not a dead end. */}
        {!query ? (
          <div className="rounded-xl border border-sand-border bg-surface p-8 sm:p-12">
            <p className="text-lg text-muted-ink font-sans mb-6">
              Search the catalogue, or start from an art form.
            </p>
            <form action="/search" method="get" className="mb-8 flex gap-2">
              <label htmlFor="q" className="sr-only">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                autoFocus
                placeholder="Search artwork, artists, categories…"
                className="flex-1 rounded-md border border-sand-border bg-surface px-4 py-3 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
              <button
                type="submit"
                className="rounded-md bg-sindoor px-5 py-3 text-sm font-medium text-rang-paper hover:bg-sindoor/90 transition-colors"
              >
                Search
              </button>
            </form>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-ink">
              Browse art forms
            </p>
            <div className="flex flex-wrap gap-2">
              {artFormSlugs.map((form) => (
                <Link
                  key={form.slug}
                  href={`/shop/${form.slug}`}
                  className="rounded-full border border-sand-border px-4 py-1.5 text-sm font-sans text-deep-ink hover:border-sindoor hover:text-sindoor transition-colors"
                >
                  {form.name}
                </Link>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-12 sm:p-16 text-center">
            <Icon name="search" size={48} className="mx-auto text-muted-ink mb-4" />
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-2">
              {failed ? t("unavailable") : t("nothingMatched", { query })}
            </h2>
            <p className="text-muted-ink font-sans mb-6">
              {failed ? t("tryAgain") : t("tryShorter")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="rounded-md bg-sindoor px-5 py-2.5 text-sm font-medium text-rang-paper hover:bg-sindoor/90 transition-colors"
              >
                {t("browseAll")}
              </Link>
              <Link
                href="/custom-art"
                className="rounded-md border border-sindoor px-5 py-2.5 text-sm font-medium text-sindoor hover:bg-sindoor hover:text-rang-paper transition-colors"
              >
                Request a piece
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((result) => (
              <article
                key={`${result.type}-${result.id}`}
                className="group rounded-xl border border-sand-border bg-surface p-5 hover:border-sindoor/50 transition-colors"
              >
                <div className="mb-3 flex items-center gap-1.5">
                  <Icon
                    name={typeIcons[result.type] as any}
                    size={14}
                    className="text-muted-ink"
                  />
                  <span className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    {t(
                      (`type${result.type.charAt(0).toUpperCase()}${result.type.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`) as
                        | "typeProduct"
                        | "typeCategory"
                        | "typeArtForm"
                        | "typeJournal"
                        | "typePage",
                      { default: result.type }
                    )}
                  </span>
                </div>
                <Link href={result.url} className="block">
                  <h3 className="text-lg font-serif font-semibold text-deep-ink mb-2 group-hover:text-sindoor transition-colors">
                    {result.title}
                  </h3>
                  {result.description && (
                    <p className="text-sm text-muted-ink font-sans mb-4 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                  {result.type === "product" && result.price != null && (
                    <p className="text-sm font-sans font-semibold text-deep-ink">
                      {(result.price / 100).toLocaleString("en-IN", {
                        style: "currency",
                        currency: (result.currency || "INR").toUpperCase(),
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  )}
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
