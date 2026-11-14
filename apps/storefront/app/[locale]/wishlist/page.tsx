"use client";

/**
 * Saved works.
 *
 * Rendered on the client because a wishlist lives in the visitor's browser, not
 * on the server. Each entry can be removed or added straight to the cart; the
 * empty state offers a clear next step instead of a blank page.
 */
import Link from "next/link";
import { useState } from "react";
import { useWishlist, type WishlistEntry } from "@/lib/hooks/use-wishlist";
import { useAddToCart } from "@/lib/hooks/use-add-to-cart";
import { formatPrice } from "@/lib/medusa";

function WishlistRow({ entry }: { entry: WishlistEntry }) {
  const { remove } = useWishlist();
  const { add, isPending, result } = useAddToCart();
  const [adding, setAdding] = useState(false);

  return (
    <li className="flex gap-4 border-b border-sand-border/60 py-5">
      <Link
        href={`/products/${entry.handle}`}
        className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-surface ring-1 ring-sand-border/50"
      >
        {entry.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link
            href={`/products/${entry.handle}`}
            className="font-serif text-base font-semibold leading-tight text-deep-ink hover:text-kumkum"
          >
            {entry.title}
          </Link>
          {entry.artist && (
            <p className="mt-0.5 font-sans text-xs italic text-muted-ink">
              {entry.artist}
            </p>
          )}
          {entry.price != null && (
            <p className="mt-1 font-sans text-sm text-deep-ink">
              {formatPrice(entry.price, (entry.currency || "inr").toUpperCase())}
            </p>
          )}
          {result && (
            <p
              role="status"
              className={`mt-1 font-sans text-xs ${
                result.ok ? "text-green-700" : "text-red-700"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setAdding(true);
              // The wishlist stores a snapshot, not a variant id, so resolve the
              // variant on demand before adding.
              try {
                const res = await fetch(
                  `/api/store/product-variant?handle=${encodeURIComponent(entry.handle)}`
                );
                const body = await res.json().catch(() => ({}));
                if (body.variantId) {
                  add(body.variantId, 1);
                }
              } finally {
                setAdding(false);
              }
            }}
            disabled={adding || isPending}
            className="rounded-full bg-sindoor px-4 py-1.5 font-sans text-xs font-medium text-rang-paper transition-colors hover:bg-sindoor/90 disabled:opacity-50"
          >
            {adding || isPending ? "Adding…" : "Add to cart"}
          </button>
          <button
            type="button"
            onClick={() => remove(entry.handle)}
            className="font-sans text-xs text-muted-ink hover:text-kumkum"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export default function WishlistPage() {
  const { entries, ready } = useWishlist();

  return (
    <main className="py-12">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <h1 className="font-serif text-3xl font-semibold text-deep-ink sm:text-4xl">
          Saved works
        </h1>
        <p className="mt-2 font-sans text-sm text-muted-ink">
          Works you have kept to consider later.
        </p>

        {!ready ? (
          <p className="mt-10 font-sans text-sm text-muted-ink">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="mt-10 rounded-sm border border-sand-border bg-surface/60 p-10 text-center">
            <p className="font-serif text-xl text-deep-ink">
              Nothing saved yet.
            </p>
            <p className="mt-2 font-sans text-sm text-muted-ink">
              Tap “Save” on any artwork to keep it here.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
            >
              Browse the collection
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <ul className="mt-8">
            {entries.map((entry) => (
              <WishlistRow key={entry.handle} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
