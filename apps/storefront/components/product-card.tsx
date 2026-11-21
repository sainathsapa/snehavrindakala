import { Link } from "@/i18n/routing";
import Image from "next/image";
import { useTranslations } from "next-intl";
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
  /**
   * The facts a wall label carries beyond title and maker.
   *
   * Optional and rendered conditionally: most records do not have a medium or
   * a dimension yet, and an empty row would claim information the catalogue does
   * not hold. Passing nothing leaves the caption exactly as it was, so the five
   * existing call sites are unaffected until the data exists.
   */
  medium?: string;
  dimensions?: string;
  /**
   * The tradition this work belongs to, shown after the maker.
   *
   * The `category` prop above never had a call site, so cards could not state a
   * tradition at all. The catalogue already carries `collection` as a plain
   * name, which is what a wall label wants — no id, no handle.
   */
  collection?: string;
  /**
   * Already sold. Every work here is one of one, so a grid that does not say so
   * quietly promises something the shop no longer has: the card still links to a
   * page whose button says Sold.
   */
  sold?: boolean;
}

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
  medium,
  dimensions,
  collection,
  sold = false,
}: ProductCardProps) {
  const hasImage = Boolean(image);
  const t = useTranslations("product");
  // Availability labels come from the catalogue so a Hindi card is fully Hindi.
  // Keyed off the same three stock types the database stores.
  const availabilityKey: Record<string, string> = {
    ready_to_ship: "readyToShip",
    made_to_order: "madeToOrder",
    custom_only: "customOnly",
  };
  const availability = availabilityKey[stockType]
    ? t(availabilityKey[stockType])
    : stockType.replace(/_/g, " ");
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
              {t("viewPlate")}
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
          {/* Maker first, then tradition — the order a wall label uses. */}
          <p className="mt-1 font-sans text-xs italic text-muted-ink">
            {artist}
            {(category?.name || collection) &&
              ` · ${category?.name || collection}`}
          </p>
          {/* One step darker than a caption: the medium is a factual claim
              about the object, so it has to be readable rather than decorative.
              muted-ink measures 6.07:1 on the paper ground; the 80% variant used
              here first measured 3.91:1, under the 4.5:1 AA minimum. */}
          {(medium || dimensions) && (
            <p className="mt-1 font-sans text-[11.5px] leading-relaxed text-muted-ink">
              {[medium, dimensions].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-2 flex items-baseline justify-between gap-3 font-sans text-xs">
            <span className={sold ? "text-terracotta" : "text-muted-ink"}>
              {sold ? t("sold") : availability}
            </span>
            <span className="font-medium text-deep-ink">{formatPrice(price, currency.toUpperCase())}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
