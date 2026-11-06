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
}

const stockLabels: Record<string, string> = {
  ready_to_ship: "Ready to ship",
  made_to_order: "Made to order",
  custom_only: "Custom only",
};

export function ProductCard({
  handle,
  title,
  artist,
  price,
  stockType,
  image,
  isNew = false,
}: ProductCardProps) {
  const hasImage = Boolean(image);

  return (
    <article className="group relative rounded-xl border border-sand-border bg-surface overflow-hidden transition-all hover:shadow-lifted">
      {isNew && (
        <span className="absolute top-3 left-3 z-10 px-2 py-1 text-[10px] font-semibold text-sindoor uppercase tracking-wider bg-rang-paper/80 backdrop-blur rounded">
          New
        </span>
      )}
      <div className="relative aspect-square overflow-hidden bg-rang-paper">
        {hasImage ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            priority={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center border border-dashed border-sand-border">
            <span className="text-xs text-muted-ink font-sans">Image pending</span>
          </div>
        )}
        <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-deep-ink/90 text-[11px] text-white font-sans font-medium">
          {stockLabels[stockType] ?? stockType.replace(/_/g, " ")}
        </span>
      </div>
      <div className="p-4">
        <Link href={`/products/${handle}`} className="block">
          <h3 className="text-lg font-serif font-semibold text-deep-ink leading-tight">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-ink font-sans">{artist}</p>
        </Link>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-sans font-bold text-deep-ink">
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </article>
  );
}
