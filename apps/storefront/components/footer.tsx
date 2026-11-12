"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Hide storefront footer on admin routes
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-sand-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-serif font-bold text-deep-ink tracking-tight">
              SnehaVrinda Kala
            </span>
            <p className="mt-4 max-w-xs text-sm text-muted-ink font-sans leading-relaxed">
              Art made, curated, personalized, and shared by creators.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-deep-ink uppercase tracking-wider mb-4">
              Shop
            </h4>
            <ul className="space-y-2 text-sm text-muted-ink font-sans">
              <li><a href="/shop" className="hover:text-terracotta transition-colors">All products</a></li>
              <li><a href="/art-forms" className="hover:text-terracotta transition-colors">Art forms</a></li>
              <li><a href="/custom-art" className="hover:text-terracotta transition-colors">Custom art</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-deep-ink uppercase tracking-wider mb-4">
              Learn
            </h4>
            <ul className="space-y-2 text-sm text-muted-ink font-sans">
              <li><a href="/journal" className="hover:text-terracotta transition-colors">Journal</a></li>
              <li><a href="/artists" className="hover:text-terracotta transition-colors">Artists</a></li>
              <li><a href="/about" className="hover:text-terracotta transition-colors">About</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-deep-ink uppercase tracking-wider mb-4">
              Policies
            </h4>
            <ul className="space-y-2 text-sm text-muted-ink font-sans">
              <li><a href="/policies/shipping" className="hover:text-terracotta transition-colors">Shipping</a></li>
              <li><a href="/policies/returns" className="hover:text-terracotta transition-colors">Returns &amp; refunds</a></li>
              <li><a href="/policies/privacy" className="hover:text-terracotta transition-colors">Privacy</a></li>
              <li><a href="/policies/terms" className="hover:text-terracotta transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-sand-border pt-8">
          <div className="max-w-md mx-auto text-center md:text-left md:mx-0">
            <h3 className="font-serif text-xl font-semibold text-deep-ink mb-3">
              Join the art house
            </h3>
            <p className="text-sm text-muted-ink font-sans mb-4">
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
                  className="flex-1 rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
                <button
                  type="submit"
                  className="rounded-md bg-sindoor px-6 py-2 font-medium text-rang-paper transition-colors hover:bg-sindoor/90"
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
                  className="mt-0.5 shrink-0 text-sindoor focus:ring-sindoor"
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
        <div className="border-t border-sand-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-ink font-sans">
            SnehaVrinda Kala. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-ink font-sans">
            <a href="mailto:hello@snehavrindakala.example" className="hover:text-terracotta transition-colors">Contact</a>
            <a href="/about" className="hover:text-terracotta transition-colors">Partner with us</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
