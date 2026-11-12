"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@snehavrinda-kala/ui";
import { CartCount } from "./cart-count";

/**
 * Navigation mirrors the brand reference: a single centred row of restrained
 * sans-serif links, with the logo mark and wordmark on the left and thin-line
 * utility icons on the right.
 */
const navLinks = [
  { label: "Discover", href: "/shop", chevron: true },
  { label: "Art Forms", href: "/art-forms", chevron: true },
  { label: "Artists", href: "/artists" },
  { label: "Custom Art", href: "/custom-art" },
  // Only meaningful in marketplace mode: in single-brand mode there is nobody
  // to sell on the platform, so the page would be a dead end.
  { label: "Sell", href: "/sell", platformOnly: true },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

const typeIcons: Record<string, string> = {
  product: "products",
  category: "categories",
  artist: "partners",
};

export function Header({
  platformMode = "single-brand",
}: {
  platformMode?: "platform" | "single-brand";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const visibleLinks = navLinks.filter(
    (link) => !link.platformOnly || platformMode === "platform"
  );

  const debouncedSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/store/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setSearchOpen(true);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchResults([]);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-sand-border/70 bg-rang-paper/95 backdrop-blur supports-[backdrop-filter]:bg-rang-paper/85">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="flex h-[88px] items-center gap-6">
          {/* Brand cluster: sprig + rule, then the lotus mark and wordmark. */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-4"
            aria-label="SnehaVrinda Kala home"
          >
            <span className="hidden flex-col items-center gap-1 text-terracotta sm:flex">
              <svg width="18" height="26" viewBox="0 0 18 26" fill="none" aria-hidden="true">
                <path d="M9 25V9" stroke="currentColor" strokeWidth="1" opacity="0.55" />
                <path d="M9 11c-4 0-7-2.5-7-5.5 4 0 7 2 7 5.5z" fill="currentColor" />
                <path d="M9 16c4 0 7-2.5 7-5.5-4 0-7 2-7 5.5z" fill="currentColor" opacity="0.65" />
              </svg>
              <span className="h-3 w-px bg-terracotta/40" aria-hidden="true" />
            </span>

            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              className="shrink-0 text-kumkum"
              aria-hidden="true"
            >
              <path
                d="M17 30c0-6 4-9 4-13a4 4 0 10-8 0c0 4 4 7 4 13z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M17 26c-3.5 0-6-2.5-6-5.5 3.5 0 6 2 6 5.5zM17 26c3.5 0 6-2.5 6-5.5-3.5 0-6 2-6 5.5z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M17 13V6M11 9l3 2M23 9l-3 2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>

            <span className="flex flex-col leading-none">
              <span className="font-serif text-[26px] font-semibold tracking-tight text-deep-ink">
                SnehaVrinda <span className="text-kumkum">Kala</span>
              </span>
              <span className="mt-1.5 font-sans text-[9px] uppercase tracking-[0.28em] text-muted-ink">
                Art · Culture · Conscious Living
              </span>
            </span>
          </Link>

          {/* Centred links. Hidden below lg; the mobile sheet carries them. */}
          <nav className="mx-auto hidden items-center gap-7 lg:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-1 whitespace-nowrap font-sans text-[13.5px] font-medium transition-colors ${
                  pathname === link.href
                    ? "text-kumkum"
                    : "text-deep-ink/85 hover:text-kumkum"
                }`}
              >
                {link.label}
                {link.chevron && (
                  <Icon
                    name="chevron-down"
                    size={13}
                    className="mt-px text-muted-ink/70 transition-transform group-hover:translate-y-0.5"
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* Utilities: thin-line icons, per the reference. */}
          <div className="ml-auto flex shrink-0 items-center gap-4 lg:ml-0">
            <div className="relative hidden md:block">
              <form onSubmit={handleSearchSubmit}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search"
                  aria-label="Search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    debouncedSearch(e.target.value);
                  }}
                  onFocus={() => setSearchOpen(searchQuery.length >= 2)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  className="w-28 rounded-full border border-sand-border bg-surface/70 py-1.5 pl-8 pr-3 font-sans text-[13px] text-deep-ink transition-[width] placeholder:text-muted-ink/70 focus:w-52 focus:outline-none focus:ring-1 focus:ring-kumkum/40"
                />
                <Icon
                  name="search"
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-ink"
                />
              </form>

              {searchOpen && searchResults.length > 0 && !searchLoading && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-sand-border bg-surface shadow-lifted">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(result.url);
                        setSearchOpen(false);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-rang-paper/60"
                    >
                      <Icon
                        name={typeIcons[result.type] as any}
                        size={14}
                        className="shrink-0 text-muted-ink"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-sans text-sm font-medium text-deep-ink">
                          {result.title}
                        </span>
                        <span className="block truncate font-sans text-xs text-muted-ink">
                          {result.type === "product" && result.price != null
                            ? `₹${result.price / 100} · Product`
                            : result.type}
                        </span>
                      </span>
                    </button>
                  ))}
                  {searchLoading && (
                    <div className="p-2 font-sans text-xs text-muted-ink">
                      Searching…
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/account"
              aria-label="Account"
              className="hidden text-deep-ink/75 transition-colors hover:text-kumkum sm:block"
            >
              <Icon name="user" size={19} />
            </Link>

            <Link
              href="/admin"
              aria-label="Admin panel"
              className="hidden text-deep-ink/75 transition-colors hover:text-kumkum lg:block"
            >
              <Icon name="lock" size={19} />
            </Link>

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative text-deep-ink/75 transition-colors hover:text-kumkum"
            >
              <Icon name="cart" size={19} />
              <CartCount />
            </Link>

            <button
              className="inline-flex items-center justify-center text-deep-ink/75 transition-colors hover:text-kumkum lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close main menu" : "Open main menu"}
            >
              <Icon name={mobileMenuOpen ? "close" : "menu"} size={21} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-sand-border/70 pb-6 pt-2 lg:hidden"
          >
            <div className="relative mb-3 mt-3">
              <input
                type="text"
                placeholder="Search artworks, artists, art forms…"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                className="w-full rounded-full border border-sand-border bg-surface py-2.5 pl-10 pr-4 font-sans text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-1 focus:ring-kumkum/40"
              />
              <Icon
                name="search"
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-ink"
              />
            </div>
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-1 py-3 font-sans text-[15px] text-deep-ink/85 hover:text-kumkum"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
