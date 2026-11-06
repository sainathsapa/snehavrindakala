"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@snehavrinda-kala/ui";

const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Art Forms", href: "/art-forms" },
  { label: "Artists", href: "/artists" },
  { label: "Custom Art", href: "/custom-art" },
  { label: "Sell", href: "/sell" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
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
              href="/admin/partners"
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
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-background border-t border-border"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-2 py-4">
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
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
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
    </header>
  );
}
