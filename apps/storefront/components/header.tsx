"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@snehavrinda-kala/ui";
import { Icon } from "@snehavrinda-kala/ui";

const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Art Forms", href: "/art-forms" },
  { label: "Artists", href: "/artists" },
  { label: "Custom Art", href: "/custom-art" },
  { label: "Sell", href: "/sell" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

const typeIcons: Record<string, string> = {
  product: "products",
  category: "categories",
  artist: "partners",
};

export function Header() {
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
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="SnehaVrinda Kala home"
          >
            <span className="text-xl font-serif font-bold text-deep-ink tracking-tight">
              SnehaVrinda
            </span>
            <span className="text-xl font-serif font-bold text-terracotta tracking-tight">
              Kala
            </span>
          </Link>

          <div className="flex items-center gap-6 md:flex-1 md:max-w-md">
            <form
              onSubmit={handleSearchSubmit}
              className="relative w-full"
            >
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products, artists, categories…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                onFocus={() => setSearchOpen(searchQuery.length >= 2)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-sand-border bg-white text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
              <Icon
                name="search"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-ink hover:text-sindoor"
              >
                <Icon name="search" size={16} />
              </button>
            </form>

            {searchOpen && searchResults.length > 0 && !searchLoading && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-sand-border bg-white shadow-xl">
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
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-rang-paper/50"
                  >
                    <Icon
                      name={typeIcons[result.type] as any}
                      size={14}
                      className="text-muted-ink"
                    />
                    <div>
                      <div className="text-sm font-sans font-medium text-deep-ink truncate">
                        {result.title}
                      </div>
                      <div className="text-xs text-muted-ink truncate">
                        {result.type === "product" && result.price != null
                          ? `₹${result.price / 100} • Product`
                          : result.type}
                      </div>
                    </div>
                  </button>
                ))}
                {searchLoading && (
                  <div className="p-2 text-xs text-muted-ink">
                    Searching…
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-sans font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-ink hover:text-terracotta transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/cart"
              className="ml-6 flex items-center gap-2 text-muted-ink hover:text-terracotta transition-colors relative"
              aria-label="Cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 11V7a4 4 0 00-8-8v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="hidden sm:inline">Cart</span>
            </Link>
            <Link
              href="/account"
              className="ml-4 text-muted-ink hover:text-terracotta transition-colors"
              aria-label="Account"
            >
              Account
            </Link>
            <Link
              href="/admin"
              className="ml-4 text-muted-ink hover:text-terracotta transition-colors"
              aria-label="Admin panel"
            >
              Admin
            </Link>
          </nav>

          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-muted-ink hover:bg-rang-paper hover:text-terracotta focus:outline-none"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Open main menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-background border-t border-border">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="space-y-2 py-4">
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search products, artists, categories…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      debouncedSearch(e.target.value);
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-md border border-sand-border bg-surface text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                  <Icon
                    name="search"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink"
                  />
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-3 py-2 rounded-md text-base font-medium text-muted-ink hover:bg-rang-paper hover:text-terracotta"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-4">
                  <Link
                    href="/cart"
                    className="block px-3 py-2 rounded-md text-base font-medium text-muted-ink hover:bg-rang-paper hover:text-terracotta flex items-center gap-2"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 11V7a4 4 0 00-8-8v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    Cart
                  </Link>
                  <Link
                    href="/account"
                    className="mt-2 block px-3 py-2 rounded-md text-base font-medium text-muted-ink hover:bg-rang-paper hover:text-terracotta"
                  >
                    Account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
