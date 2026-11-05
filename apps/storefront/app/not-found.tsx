import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl md:text-8xl font-serif font-semibold text-ink">
        404
      </h1>
      <p className="mt-4 text-xl text-muted font-sans">
        We couldn&rsquo;t find that page.
      </p>
      <div className="mt-8">
        <Link
          href="/"
          className="px-6 py-3 bg-terracotta text-white rounded-md font-medium hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
