"use client";

/**
 * The heart on a product page.
 *
 * A saved work is a light commitment — no account needed, no server call. The
 * button reflects saved state immediately and toggles in place.
 */
import { useWishlist } from "@/lib/hooks/use-wishlist";
import { useTranslations } from "next-intl";

export function WishlistButton({
  handle,
  title,
  image,
  price,
  currency,
  artist,
}: {
  handle: string;
  title: string;
  image?: string;
  price?: number | null;
  currency?: string;
  artist?: string;
}) {
  const { has, toggle, ready } = useWishlist();
  const t = useTranslations("productDetail");
  const saved = ready && has(handle);

  return (
    <button
      type="button"
      onClick={() => toggle({ handle, title, image, price, currency, artist })}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 font-sans text-sm transition-colors ${
        saved
          ? "border-sindoor bg-sindoor/5 text-sindoor"
          : "border-sand-border text-deep-ink/80 hover:border-sindoor/60 hover:text-sindoor"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0112 8a3.6 3.6 0 017 2.6c0 5-7 9.4-7 9.4z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {saved ? t("saved") : t("save")}
    </button>
  );
}
