import Link from "next/link";
import { listArtForms } from "@/lib/site-content";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * The 404 that a locale route never reaches.
 *
 * With `[locale]` routing, a path that matches no route at all — `/nope`,
 * `/shop/nope/deeper` — is resolved by the root not-found, not the one inside
 * `app/[locale]`. Without this file Next served its own stripped "This page
 * could not be found" screen: no header, no footer, no way back. That is the
 * worst page to strand someone on.
 *
 * This is a server component so it can offer the real art forms rather than a
 * hardcoded list that drifts from the database.
 */
export default async function NotFound() {
  let artForms: { name: string; slug: string }[] = [];
  try {
    artForms = (await listArtForms()).slice(0, 6);
  } catch {
    // A missing database must not turn a 404 into a 500.
    artForms = [];
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-sindoor">
        404
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-deep-ink md:text-4xl">
        We couldn&rsquo;t find that page.
      </h1>
      <p className="mt-3 max-w-md font-sans text-muted-ink">
        It may have moved, or the link may be out of date. Here are a few good
        places to start instead.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md bg-sindoor px-6 py-3 font-medium text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2"
        >
          Browse all art
        </Link>
        <Link
          href="/custom-art"
          className="rounded-md border border-sindoor px-6 py-3 font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2"
        >
          Request custom art
        </Link>
      </div>

      {artForms.length > 0 && (
        <div className="mt-10 flex max-w-lg flex-wrap justify-center gap-2">
          {artForms.map((form) => (
            <Link
              key={form.slug}
              href={`/shop/${form.slug}`}
              className="rounded-full border border-sand-border px-4 py-1.5 font-sans text-sm text-muted-ink transition-colors hover:border-sindoor hover:text-sindoor"
            >
              {form.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
