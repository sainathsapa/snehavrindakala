import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@snehavrinda-kala/ui";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "product" | "category" | "artist";
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  price?: number | null;
  currency?: string;
  handle?: string | null;
  url: string;
  matchScore: number;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const { q } = await searchParams;

  if (!q) {
    notFound();
  }

  let results: SearchResult[] = [];
  let count = 0;

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/store/search?q=${encodeURIComponent(q)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = (await res.json()) as SearchResponse;
      results = data.results;
      count = data.count;
    }
  } catch (error) {
    console.error("Failed to load search results", error);
  }

  const typeIcons: Record<string, string> = {
    product: "products",
    category: "categories",
    artist: "partners",
  };

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
          >
            ← Back to Shop
          </Link>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight">
            Search results for “{q}”
          </h1>
        </div>

        {results.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-16 text-center">
            <Icon
              name="search"
              size={48}
              className="mx-auto text-muted-ink mb-4"
            />
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-2">
              No results found
            </h2>
            <p className="text-muted-ink font-sans">
              Try searching for something else.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {results.map((result) => (
              <article
                key={`${result.type}-${result.id}`}
                className="rounded-xl border border-sand-border bg-surface p-5 hover:border-terracotta/50 transition-colors"
              >
                <div className="mb-4">
                  <Icon
                    name={typeIcons[result.type] as any}
                    size={16}
                    className="mr-1 text-muted-ink"
                  />
                  <span className="text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                    {result.type}
                  </span>
                </div>
                <Link href={result.url} className="block">
                  <h3 className="text-lg font-serif font-semibold text-deep-ink mb-2 group-hover:text-terracotta transition-colors">
                    {result.title}
                  </h3>
                  {result.description && (
                    <p className="text-sm text-muted-ink font-sans mb-4 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                  {result.type === "product" && result.price != null && (
                    <p className="text-sm font-sans font-semibold text-deep-ink">
                      {result.price / 100} {result.currency?.toUpperCase()}
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
