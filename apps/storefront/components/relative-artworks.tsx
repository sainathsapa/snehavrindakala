/**
 * "More from this tradition" — related artworks on a product page.
 *
 * A buyer who has just considered one piece is the most likely person to
 * consider a sibling. Items are drawn from the same collection; when the
 * collection has too few, the list simply shows what exists rather than
 * padding with unrelated work. Nothing renders when there are no siblings.
 */
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { listCatalogueFor } from "@/lib/catalogue";
import { formatPrice } from "@/lib/medusa";

export async function RelativeArtworks({
  handle,
  collection,
}: {
  handle: string;
  collection?: string;
}) {
  if (!collection) return null;

  let items: Awaited<ReturnType<typeof listCatalogueFor>> = [];
  try {
    items = await listCatalogueFor([collection]);
  } catch {
    return null;
  }

  const related = items.filter((item) => item.handle !== handle).slice(0, 4);
  if (related.length === 0) return null;

  return (
    <section className="mt-20 border-t border-sand-border/60 pt-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
            From the same tradition
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
            {collection}
          </h2>
        </div>
        <Link
          href="/shop"
          className="shrink-0 font-sans text-sm text-terracotta hover:text-kumkum"
        >
          All works →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {related.map((item) => (
          <Link key={item.handle} href={`/products/${item.handle}`} className="group">
            <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(max-width: 1024px) 45vw, 22vw"
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
              />
            </div>
            <h3 className="mt-3 font-serif text-base font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
              {item.title}
            </h3>
            <p className="mt-0.5 font-sans text-xs italic text-muted-ink">
              {item.artist}
            </p>
            <p className="mt-1 font-sans text-xs text-deep-ink">
              {formatPrice(item.price, item.currency.toUpperCase())}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
