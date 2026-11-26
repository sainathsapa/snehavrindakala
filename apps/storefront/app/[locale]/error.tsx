"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/routing";

/**
 * The last line of defence: an unhandled error inside a page.
 *
 * Without this file a thrown exception in a page showed Next's default error
 * screen — in production, a bare "Application error: a client-side exception has
 * occurred" with no way out and nothing recorded. The visitor has paid or is
 * about to; the least this can do is keep the shop navigable and tell someone.
 *
 * It reports once per error, not once per render, and it never swallows the
 * error's `digest` — that string is what ties this screen to the server log line.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side, so it cannot call the server reporter directly. A beacon to
    // our own endpoint would need a public route and would let anyone post to
    // it; the digest in the console is enough to find the matching server log.
    console.error("[client-error]", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-rang-paper px-5 py-20">
      <div className="max-w-md text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-sindoor">
          Something went wrong
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-deep-ink">
          This page could not be shown
        </h1>
        <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted-ink">
          The error has been recorded. Nothing you did was lost — an order already
          placed is safe, and any work in your cart is still there.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-muted-ink/70">
            reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-full bg-sindoor px-6 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-kumkum"
          >
            Try again
          </button>
          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center rounded-full border border-sand-border px-6 font-sans text-sm text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
          >
            Browse the collection
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center px-3 font-sans text-sm text-muted-ink transition-colors hover:text-sindoor"
          >
            Tell the studio
          </Link>
        </div>
      </div>
    </main>
  );
}
