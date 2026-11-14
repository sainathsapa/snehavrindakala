"use client";

/**
 * Header wishlist indicator.
 *
 * Shows the saved count and links to /wishlist. The count updates live when a
 * heart is toggled anywhere on the page (via the `svk:wishlist-changed` event
 * dispatched by the wishlist store). Renders nothing while unknown so it does
 * not flash a zero on first paint.
 */
import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";
import { useWishlist } from "@/lib/hooks/use-wishlist";

export function WishlistLink() {
  const { entries, ready } = useWishlist();
  const count = entries.length;

  return (
    <Link
      href="/wishlist"
      aria-label={
        ready && count > 0 ? `Wishlist, ${count} saved` : "Wishlist"
      }
      className="relative hidden text-deep-ink/75 transition-colors hover:text-kumkum sm:block"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0112 8a3.6 3.6 0 017 2.6c0 5-7 9.4-7 9.4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {ready && count > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-kumkum px-1 text-[9px] font-semibold leading-none text-rang-paper"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
