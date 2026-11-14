import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/medusa";
import { TiltPlate } from "@/components/interactive";

interface ProductCardProps {
  handle: string;
  title: string;
  artist: string;
  price: number | null;
  currency?: string;
  stockType: string;
  image: string;
  isNew?: boolean;
  category?: { id: string; name: string; handle?: string } | null;
  /** Shown as a catalogue plate number when the card is part of a set. */
  plate?: number;
}

const stockLabels: Record<string, string> = {
  ready_to_ship: "Ready to ship",
  made_to_order: "Made to order",
  custom_only: "Commission only",
};

/**
 * A work, presented as a framed plate.
 *
 * A wall label is not a product tile: no box, no shadow, no badge. The artwork
 * sits on parchment, a hairline runs beneath it, and the caption carries title,
 * maker and medium in that order.
 *
 * The interaction follows the metaphor. The image is a *framed object*, so it
 * tilts slightly toward the pointer and catches a sheen as you move across it —
 * the way a glazed canvas does when you walk past it. The rule beneath the
 * caption draws itself left to right on hover, like a stroke being laid down.
 * Nothing scales, nothing pops; an artwork should not jump at you.
 */
export function ProductCard({
  handle,
  title,
  artist,
  price,
  currency = "inr",
  stockType,
  image,
  isNew = false,
  category,
  plate,
}: ProductCardProps) {
  const hasImage = Boolean(image);
  const availability = stockLabels[stockType] ?? stockType.replace(/_/g, " ");

  return (
    <article className="group">
      <Link href={`/products/${handle}`} className="block focus:outline-none">
        <TiltPlate max={5} className="rounded-[2px]">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
            {hasImage ? (
              <Image
                src={image}
                alt={`${title} by ${artist}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                className="object-cover transition-[opacity,filter] duration-700 group-hover:opacity-95 group-hover:brightness-[1.04]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-serif text-sm italic text-muted-ink/60">
                  Image to follow
                </span>
              </div>
            )}

            {/* The brushstroke that wipes the image when you hover — a wash
                crossing the surface, not a colour overlay. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-gradient-to-t from-[#2A120C]/55 via-[#2A120C]/10 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
            />

            {/* "View plate" appears low-left as the wash arrives. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-3 translate-y-2 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-rang-paper/90 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100"
            >
              View plate →
            </span>

            {isNew && (
              <span className="absolute left-0 top-4 bg-kumkum px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-rang-paper">
                New
              </span>
            )}
          </div>
        </TiltPlate>

        {/* Wall-label caption. */}
        <div className="mt-4 pt-3">
          {/* A rule that draws itself on hover, replacing the static border. */}
          <div className="relative h-px w-full bg-sand-border/60">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-kumkum/70 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
            />
          </div>

          {plate !== undefined && (
            <span className="mt-2 block font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta/70 tabular-nums">
              Plate {String(plate).padStart(2, "0")}
            </span>
          )}

          <h3 className="mt-1 font-serif text-lg font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
            {title}
          </h3>
          <p className="mt-1 font-sans text-xs italic text-muted-ink">
            {artist}
            {category ? ` · ${category.name}` : ""}
          </p>
          <p className="mt-2 flex items-baseline justify-between gap-3 font-sans text-xs">
            <span className="text-muted-ink">{availability}</span>
            <span className="font-medium text-deep-ink">{formatPrice(price, currency.toUpperCase())}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
