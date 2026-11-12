"use client";

import { usePathname } from "next/navigation";
import { MandalaField, KalamBorder } from "./ornaments";

export function Footer() {
  const pathname = usePathname();

  // Hide storefront footer on admin routes
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative mt-auto border-t border-sand-border bg-rang-paper">
      {/* Woven border and a faint rosette keep the footer in the same visual
          language as the editorial bands above it. */}
      <KalamBorder className="w-full text-terracotta/30" />
      <MandalaField className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 text-terracotta/[0.06]" />
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <span className="flex items-center gap-3">
              <svg
                width="26"
                height="26"
                viewBox="0 0 34 34"
                fill="none"
                className="shrink-0 text-kumkum"
                aria-hidden="true"
              >
                <path
                  d="M17 30c0-6 4-9 4-13a4 4 0 10-8 0c0 4 4 7 4 13z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 26c-3.5 0-6-2.5-6-5.5 3.5 0 6 2 6 5.5zM17 26c3.5 0 6-2.5 6-5.5-3.5 0-6 2-6 5.5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-serif text-xl font-semibold tracking-tight text-deep-ink">
                SnehaVrinda <span className="text-kumkum">Kala</span>
              </span>
            </span>
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-muted-ink">
              Art made, curated, personalized, and shared by creators. Bring
              home a piece of India&apos;s soul.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
              Shop
            </h4>
            <ul className="space-y-2.5 font-sans text-sm text-muted-ink">
              <li><a href="/shop" className="hover:text-kumkum transition-colors">All artworks</a></li>
              <li><a href="/art-forms" className="hover:text-kumkum transition-colors">Art forms</a></li>
              <li><a href="/custom-art" className="hover:text-kumkum transition-colors">Custom art</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
              Learn
            </h4>
            <ul className="space-y-2.5 font-sans text-sm text-muted-ink">
              <li><a href="/journal" className="hover:text-kumkum transition-colors">Journal</a></li>
              <li><a href="/artists" className="hover:text-kumkum transition-colors">Our artists</a></li>
              <li><a href="/about" className="hover:text-kumkum transition-colors">About</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
              Policies
            </h4>
            <ul className="space-y-2.5 font-sans text-sm text-muted-ink">
              <li><a href="/policies/shipping" className="hover:text-kumkum transition-colors">Shipping</a></li>
              <li><a href="/policies/returns" className="hover:text-kumkum transition-colors">Returns &amp; refunds</a></li>
              <li><a href="/policies/privacy" className="hover:text-kumkum transition-colors">Privacy</a></li>
              <li><a href="/policies/terms" className="hover:text-kumkum transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-sand-border pt-10">
          <div className="mx-auto max-w-md text-center md:mx-0 md:text-left">
            <h3 className="mb-3 font-serif text-xl font-semibold text-deep-ink">
              Join the art house
            </h3>
            <p className="mb-4 font-sans text-sm text-muted-ink">
              New collections, artist stories, and workshop invitations.
            </p>
            <form
              className="space-y-3"
              action="/api/newsletter"
              method="POST"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  name="email"
                  type="email"
                  placeholder="Your email"
                  aria-label="Your email"
                  required
                  className="flex-1 rounded-full border border-sand-border bg-surface px-4 py-2.5 font-sans text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-1 focus:ring-kumkum/40"
                />
                <button
                  type="submit"
                  className="rounded-full bg-kumkum px-6 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                >
                  Subscribe
                </button>
              </div>
              {/* Consent sits on its own line: sharing a row with the input
                  squeezed it into a narrow column of very short wrapped lines. */}
              <label className="flex items-start gap-2 font-sans text-xs leading-snug text-muted-ink">
                <input
                  name="consent"
                  type="checkbox"
                  className="mt-0.5 shrink-0 text-kumkum focus:ring-kumkum"
                  required
                />
                <span>
                  I consent to receive updates from SnehaVrinda Kala. You can
                  unsubscribe anytime.
                </span>
              </label>
            </form>
          </div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-sand-border pt-8 md:flex-row md:items-center">
          <p className="font-sans text-xs text-muted-ink">
            SnehaVrinda Kala. All rights reserved.
          </p>
          <div className="flex items-center gap-6 font-sans text-xs text-muted-ink">
            <a href="mailto:hello@snehavrindakala.example" className="hover:text-kumkum transition-colors">Contact</a>
            <a href="/about" className="hover:text-kumkum transition-colors">Partner with us</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
