"use client";

import { Link } from "@/i18n/routing";
import Image from "next/image";
/**
 * `usePathname` comes from the locale-aware module too: it returns the path
 * *without* the `/hi` prefix, which is what the nav links below compare
 * against. The raw next/navigation hook would have returned `/hi/shop` and
 * left every link looking inactive on the Hindi site.
 */
import { usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@snehavrinda-kala/ui";
import { formatPrice } from "@/lib/medusa";
import { nextActiveIndex, activeResult } from "@/lib/search-keyboard";
import { CartCount } from "./cart-count";
import { WishlistLink } from "./wishlist-link";
import { KalamBorder } from "./ornaments";

/**
 * Navigation mirrors the brand reference: a single centred row of restrained
 * sans-serif links, with the logo mark and wordmark on the left and thin-line
 * utility icons on the right.
 */
const navLinks = [
  // Four entries. A visitor should be able to hold the whole site in their
  // head: browse the work, read about the traditions, ask for a commission,
  // understand who we are. Artists and Sell are marketplace concepts and only
  // appear in platform mode.
  //
  // "Discover" carries the only browse menu — a small gallery of the six
  // traditions, each linking to its shelf in the shop. "Art Forms" is a plain
  // link to the traditions index, which is where you read about them instead.
  // They were once two dropdowns over the same taxonomy, showing the same
  // pictures under different names, which is just a decision a visitor has to
  // make for no reason.
  { key: "discover", href: "/shop", menu: "discover" as const },
  // Rooms sit beside the shop, not under it: they are the way the collection is
  // arranged when someone else has already done the choosing.
  { key: "rooms", href: "/rooms" },
  { key: "artForms", href: "/art-forms" },
  { key: "learn", href: "/learn" },
  { key: "request", href: "/custom-art" },
  { key: "journal", href: "/journal" },
  // A shop with no contact page sends people to a mailto: link; this is the
  // address the terms, invoice and every policy point at.
  { key: "contact", href: "/contact" },
  { key: "studio", href: "/about", menu: "studio" as const },
  // Both render in single-brand mode now — a house that names its makers should
  // not hide them, and "work with us" is a question makers actually ask.
  { key: "artists", href: "/artists" },
  { key: "sell", href: "/sell" },
];

const typeIcons: Record<string, string> = {
  product: "products",
  category: "categories",
  artist: "partners",
};

export function Header({
  platformMode = "single-brand",
  artForms = [],
}: {
  platformMode?: "platform" | "single-brand";
  // The currency switcher lives in the footer now; the header no longer needs
  // to know which currency is active.
  /** Art traditions, rendered as a small gallery inside the Discover menu. */
  artForms?: {
    label: string;
    href: string;
    image?: string;
    meta?: string;
    description?: string;
  }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Which dropdown is open. CSS-only hover menus cannot be reached by keyboard
  // or touch, so the menu is explicitly state-driven with click and Escape.
  const [openMenu, setOpenMenu] = useState<null | "discover" | "studio">(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Which result is highlighted for keyboard users. -1 means none, so the input
  // keeps focus and Enter submits the full search instead of an option.
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  // Close menus on navigation, otherwise the panel survives the route change.
  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Nothing in the top nav is mode-gated any more: /artists and /sell render in
  // both modes, so the old platformOnly filter had no members left to hide.
  const visibleLinks = navLinks;

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
        setSearchActiveIndex(-1);
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

  // Arrow keys move through the result list, Enter opens the highlighted
  // result, Escape closes the panel. Without this the dropdown was only usable
  // by mouse even though it looked like a standard type-ahead.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchActiveIndex((i) => nextActiveIndex(i, 1, searchResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchActiveIndex((i) => nextActiveIndex(i, -1, searchResults.length));
    } else if (e.key === "Enter" && searchActiveIndex >= 0) {
      e.preventDefault();
      const result = activeResult(searchResults, searchActiveIndex);
      if (result) {
        router.push(result.url);
        setSearchOpen(false);
        setSearchResults([]);
        setSearchQuery("");
        setSearchActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchActiveIndex(-1);
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
          <nav ref={menuRef} className="mx-auto hidden items-center gap-7 lg:flex">
            {visibleLinks.map((link) => {
              const menuId = link.menu ? `nav-menu-${link.menu}` : undefined;
              const isOpen = Boolean(link.menu && openMenu === link.menu);
              const entries =
                link.menu === "discover"
                  ? artForms
                  : link.menu === "studio"
                    ? [
                        { label: "Our story", href: "/about" },
                        { label: "The journal", href: "/journal" },
                        { label: "Request a piece", href: "/custom-art" },
                        { label: "Contact", href: "mailto:hello@snehavrinda.in" },
                      ]
                    : [];

              if (!link.menu) {
                // A nav item stays active on its own sub-pages: /shop should
                // still read as current on /shop/painting. An exact match left
                // every interior page with an inactive header, so the site
                // always looked like you had not gone anywhere.
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(`${link.href}/`));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-1.5 whitespace-nowrap font-sans text-[13.5px] font-medium transition-colors ${
                      active
                        ? "text-kumkum"
                        : "text-deep-ink/85 hover:text-kumkum"
                    }`}
                  >
                    {t(link.key as any)}
                    <span
                      aria-hidden="true"
                      className={`absolute -bottom-1.5 left-0 h-[1.5px] bg-kumkum transition-all duration-300 ${
                        active
                          ? "w-full opacity-100"
                          : "w-0 opacity-0 group-hover:w-full group-hover:opacity-60"
                      }`}
                    />
                  </Link>
                );
              }

              return (
                <div key={link.href} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu(isOpen ? null : link.menu!)}
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    aria-haspopup="true"
                    className={`group flex items-center gap-1 whitespace-nowrap font-sans text-[13.5px] font-medium transition-colors ${
                      isOpen || pathname.startsWith(link.href)
                        ? "text-kumkum"
                        : "text-deep-ink/85 hover:text-kumkum"
                    }`}
                  >
                    {t(link.key as any)}
                    <Icon
                      name="chevron-down"
                      size={13}
                      className={`mt-px text-muted-ink/70 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={menuId}
                      className={`absolute left-1/2 top-full z-50 mt-3 -translate-x-1/2 overflow-hidden border border-sand-border bg-surface shadow-lifted ${
                        link.menu === "discover"
                          ? "w-[440px] rounded-sm sm:w-[560px]"
                          : "w-72 rounded-lg"
                      }`}
                    >
                      {/* The art-forms menu is a small gallery: each tradition
                          shows its own painting, its region, and the form's
                          name set as a plate caption. A dropdown of bare words
                          gives a visitor nothing to recognise — but an image
                          of a Madhubani border is instantly a Madhubani border. */}
                      {link.menu === "discover" ? (
                        <>
                          <div className="flex items-center justify-between border-b border-sand-border/70 px-4 py-2.5">
                            <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta">
                              The traditions
                            </span>
                            <span className="font-serif text-[10px] italic text-muted-ink">
                              six living forms
                            </span>
                          </div>
                          <ul className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
                            {entries.map((entry: any) => (
                              <li key={entry.href}>
                                <Link
                                  href={entry.href}
                                  onClick={() => setOpenMenu(null)}
                                  className="group/form block rounded-sm p-1.5 transition-colors hover:bg-rang-paper/80"
                                >
                                  <span className="relative block aspect-[4/3] overflow-hidden bg-rang-paper ring-1 ring-sand-border/50">
                                    {entry.image ? (
                                      <Image
                                        src={entry.image}
                                        alt=""
                                        fill
                                        sizes="130px"
                                        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/form:scale-[1.07]"
                                      />
                                    ) : (
                                      <span className="block h-full w-full" />
                                    )}
                                  </span>
                                  {/* Title over region, stacked. Side by side,
                                      the region text collided with the next
                                      card's title in a 130px cell. */}
                                  <span className="mt-1.5 block border-t border-sand-border/50 pt-1">
                                    <span className="block truncate font-serif text-[13px] font-semibold leading-tight text-deep-ink transition-colors group-hover/form:text-kumkum">
                                      {entry.label}
                                    </span>
                                    {entry.meta && (
                                      <span className="mt-0.5 block truncate font-sans text-[8.5px] uppercase tracking-[0.08em] text-muted-ink/60">
                                        {entry.meta}
                                      </span>
                                    )}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <ul className="py-2">
                          {entries.length === 0 && (
                            <li className="px-4 py-3 font-sans text-xs text-muted-ink">
                              Nothing listed yet.
                            </li>
                          )}
                          {entries.map((entry: any) => (
                            <li key={entry.href}>
                              <Link
                                href={entry.href}
                                onClick={() => setOpenMenu(null)}
                                className="flex items-baseline justify-between gap-3 px-4 py-2 font-sans text-[13.5px] text-deep-ink/85 transition-colors hover:bg-rang-paper/70 hover:text-kumkum"
                              >
                                <span className="truncate">{entry.label}</span>
                                {entry.meta && (
                                  <span className="shrink-0 font-sans text-[11px] text-muted-ink">
                                    {entry.meta}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="border-t border-sand-border/70 bg-rang-paper/50 px-4 py-2.5">
                        <Link
                          href={link.href}
                          onClick={() => setOpenMenu(null)}
                          className="font-sans text-xs font-medium text-terracotta hover:text-kumkum"
                        >
                          {link.menu === "discover"
                            ? "Browse every work"
                            : "About the studio"}{" "}
                          →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Utilities: thin-line icons, per the reference. */}
          <div className="ml-auto flex shrink-0 items-center gap-4 lg:ml-0">
            <div className="relative hidden md:block">
              <form onSubmit={handleSearchSubmit} role="search">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search"
                  aria-label="Search"
                  role="combobox"
                  aria-expanded={searchOpen && searchResults.length > 0}
                  aria-controls="header-search-results"
                  aria-autocomplete="list"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    debouncedSearch(e.target.value);
                  }}
                  onFocus={() => setSearchOpen(searchQuery.length >= 2)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-28 rounded-full border border-sand-border bg-surface/70 py-1.5 pl-8 pr-3 font-sans text-[13px] text-deep-ink transition-[width] placeholder:text-muted-ink/70 focus:w-52 focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50"
                />
                <Icon
                  name="search"
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-ink"
                />
              </form>

              {searchOpen && searchResults.length > 0 && !searchLoading && (
                <div
                  id="header-search-results"
                  role="listbox"
                  aria-label="Search results"
                  className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-sand-border bg-surface shadow-lifted"
                >
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === searchActiveIndex}
                      onMouseEnter={() => setSearchActiveIndex(index)}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(result.url);
                        setSearchOpen(false);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                        index === searchActiveIndex
                          ? "bg-rang-paper/70"
                          : "hover:bg-rang-paper/60"
                      }`}
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
                            ? `${formatPrice(result.price, result.currency) } · Product`
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

            {/* Language and currency live in the footer, so the desktop row is
                not carrying a second set of controls. The mobile menu sheet
                still holds its own compact copies (below), because on a phone
                the footer is many screens away and a visitor should not have
                to scroll to the bottom to change language. */}

            <Link
              href="/account"
              aria-label="Account"
              className="hidden text-deep-ink/75 transition-colors hover:text-kumkum sm:block"
            >
              <Icon name="user" size={19} />
            </Link>

            <WishlistLink />

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
            <div className="relative mb-4 mt-3" role="search">
              <input
                type="text"
                placeholder={t("search")}
                aria-label={t("searchLabel")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                className="w-full rounded-full border border-sand-border bg-surface py-2.5 pl-10 pr-4 font-sans text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50"
              />
              <Icon
                name="search"
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-ink"
              />
            </div>
            {visibleLinks.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-md px-1 py-2 font-sans text-[15px] text-deep-ink/85 hover:text-kumkum"
                >
                  {t(link.key as any)}
                </Link>
                {/* Sub-links are listed inline rather than behind a toggle: on a
                    phone there is room, and an extra tap to reveal five links is
                    friction for no gain. */}
                {link.menu === "discover" && artForms.length > 0 && (
                  <div className="mb-1 border-l border-sand-border pl-3">
                    {artForms.map((form) => (
                      <Link
                        key={form.href}
                        href={form.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1.5 font-sans text-[13px] text-muted-ink hover:text-kumkum"
                      >
                        {form.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Language and currency live in the footer, where a preference
                belongs and where one copy serves every screen size. They used to
                be duplicated here for phones, which put two sets of the same two
                controls on the page and left neither where a reader looks for a
                language. The header row stays free for the menu, search, account
                and cart. */}
          </div>
        )}
      </div>
      <KalamBorder className="w-full text-terracotta/25" />
    </header>
  );
}
