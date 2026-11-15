import { Link } from "@/i18n/routing";
import { artFormSlugs } from "@/lib/slugs";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-sindoor">
        404
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
        We couldn&rsquo;t find that page.
      </h1>
      <p className="mt-3 max-w-md text-muted-ink font-sans">
        It may have moved, or the link may be out of date. Here are a few good
        places to start instead.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md bg-sindoor px-6 py-3 font-medium text-rang-paper hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
        >
          Browse all art
        </Link>
        <Link
          href="/custom-art"
          className="rounded-md border border-sindoor px-6 py-3 font-medium text-sindoor hover:bg-sindoor hover:text-rang-paper focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
        >
          Request custom art
        </Link>
      </div>

      <div className="mt-10 flex max-w-lg flex-wrap justify-center gap-2">
        {artFormSlugs.slice(0, 6).map((form) => (
          <Link
            key={form.slug}
            href={`/shop/${form.slug}`}
            className="rounded-full border border-sand-border px-4 py-1.5 text-sm font-sans text-muted-ink hover:border-sindoor hover:text-sindoor transition-colors"
          >
            {form.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
