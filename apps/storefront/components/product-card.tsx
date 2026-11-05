import Link from "next/link";
import { format } from "date-fns";

interface ProductCardProps {
  id: string;
  title: string;
  artist: string;
  price: number;
  stockType: "ready_to_ship" | "made_to_order" | "custom_only";
  image: string;
  isNew?: boolean;
}

export function ProductCard({
  id,
  title,
  artist,
  price,
  stockType,
  image,
  isNew = false,
}: ProductCardProps) {
  const stockLabels: Record<string, string> = {
    ready_to_ship: "Ready to ship",
    made_to_order: "Made to order",
    custom_only: "Custom only",
  };

  return (
    <article className="group rounded-xl border border-border bg-surface overflow-hidden transition-all hover:shadow-md">
      {isNew && (
        <span className="absolute top-3 left-3 px-2 py-1 text-[10px] font-semibold text-terracotta uppercase tracking-wider bg-white/80 backdrop-blur rounded">
          New
        </span>
      )}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-ink/90 text-[11px] text-white font-sans font-medium">
          {stockLabels[stockType]}
        </span>
      </div>
      <div className="p-4">
        <Link href={`/products/${id}`} className="block">
          <h3 className="text-lg font-serif font-semibold text-ink leading-tight">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted font-sans">{artist}</p>
        </Link>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-sans font-bold text-ink">
            ₹{price.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </article>
  );
}
