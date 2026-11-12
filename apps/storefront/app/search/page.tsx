import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";
import { universalSearch, type SearchResult } from "@/lib/search";
import { artFormSlugs } from "@/lib/slugs";

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

  let results: SearchResult[] = [];
  let count = 0;
  let failed = false;

  if (query) {
    try {
      const data = await universalSearch(query);
      results = data.results;
      count = data.count;
    } catch (error) {
      console.error("Failed to load search results", error);
      failed = true;
    }
  }

  const typeIcons: Record<string, string> = {
    product: "products",
    category: "categories",
    artist: "partners",
  };

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm font-sans">
          <Link
            href="/shop"
            className="text-muted-ink hover:text-sindoor transition-colors"
          >
            ← Back to shop
          </Link>
        </nav>

        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight mb-2">
          {query ? `Results for “${query}”` : "Search"}
        </h1>
        {query && !failed && (
          <p className="mb-8 text-sm text-muted-ink font-sans">
            {count} result{count === 1 ? "" : "s"}
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
              {failed ? "Search is unavailable right now" : `Nothing matched “${query}”`}
            </h2>
            <p className="text-muted-ink font-sans mb-6">
              {failed
                ? "Please try again in a moment."
                : "Try a shorter phrase, a medium, or an art form."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="rounded-md bg-sindoor px-5 py-2.5 text-sm font-medium text-rang-paper hover:bg-sindoor/90 transition-colors"
              >
                Browse all art
              </Link>
              <Link
                href="/custom-art"
                className="rounded-md border border-sindoor px-5 py-2.5 text-sm font-medium text-sindoor hover:bg-sindoor hover:text-rang-paper transition-colors"
              >
                Commission a piece
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
                    {result.type}
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
