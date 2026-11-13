import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/medusa";

interface ProductCardProps {
  handle: string;
  title: string;
  artist: string;
  price: number | null;
  stockType: string;
  image: string;
  isNew?: boolean;
  category?: { id: string; name: string; handle?: string } | null;
}

const stockLabels: Record<string, string> = {
  ready_to_ship: "Ready to ship",
  made_to_order: "Made to order",
  custom_only: "Commission only",
};

/**
 * A work, presented as a gallery plate.
 *
 * The old card was a bordered product tile with a shadow and a stock badge —
 * unmistakably a shop. Here the artwork sits on parchment with a thin rule
 * beneath it, and the caption carries the title, the artist and the medium the
 * way a wall label does. There is no box, no shadow, no scale-on-hover: the
 * image may brighten very slightly, and that is the whole interaction.
 */
export function ProductCard({
  handle,
  title,
  artist,
  price,
  stockType,
  image,
  isNew = false,
  category,
}: ProductCardProps) {
  const hasImage = Boolean(image);
  const availability = stockLabels[stockType] ?? stockType.replace(/_/g, " ");

  return (
    <article className="group">
      <Link href={`/products/${handle}`} className="block focus:outline-none">
        <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
          {hasImage ? (
            <Image
              src={image}
              alt={`${title} by ${artist}`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="object-cover transition-opacity duration-500 group-hover:opacity-90"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-serif text-sm italic text-muted-ink/60">
                Image to follow
              </span>
            </div>
          )}

          {isNew && (
            <span className="absolute left-0 top-4 bg-kumkum px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-rang-paper">
              New
            </span>
          )}
        </div>

        {/* Wall-label caption. */}
        <div className="mt-4 border-t border-sand-border/60 pt-3">
          <h3 className="font-serif text-lg font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
            {title}
          </h3>
          <p className="mt-1 font-sans text-xs italic text-muted-ink">
            {artist}
            {category ? ` · ${category.name}` : ""}
          </p>
          <p className="mt-2 flex items-baseline justify-between gap-3 font-sans text-xs">
            <span className="text-muted-ink">{availability}</span>
            <span className="font-medium text-deep-ink">{formatPrice(price)}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
