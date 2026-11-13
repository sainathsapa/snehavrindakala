"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

/**
 * The footer is built as a **torana** — the ceremonial gateway.
 *
 * An Indian threshold is not a border; it is a composition. It carries a kalash
 * at its head, a border of paisleys at its foot, and it is divided into fields
 * the way a carved screen is. That logic drives the layout here: a kalash
 * crowning the centre, a four-field grid like a courtyard plan, then a thick
 * decorative plinth carrying the imprint and the credit.
 */
const LINK_GROUPS = [
  {
    heading: "Explore",
    links: [
      { label: "All works", href: "/shop" },
      { label: "Art forms", href: "/art-forms" },
      { label: "Artists", href: "/artists" },
      { label: "Journal", href: "/journal" },
    ],
  },
  {
    heading: "Commission",
    links: [
      { label: "Custom art", href: "/custom-art" },
      { label: "How it works", href: "/custom-art#process" },
      { label: "Our story", href: "/about" },
      { label: "Contact", href: "mailto:hello@snehavrindakala.example" },
    ],
  },
  {
    heading: "Care",
    links: [
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns & refunds", href: "/policies/returns" },
      { label: "Privacy", href: "/policies/privacy" },
      { label: "Terms", href: "/policies/terms" },
    ],
  },
];

export function Footer({
  platformMode = false,
}: {
  /** The Artists directory only exists in platform mode. */
  platformMode?: boolean;
}) {
  const pathname = usePathname();

  // Hide storefront footer on admin routes
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative mt-auto overflow-hidden bg-[#2A120C] text-rang-paper">
      {/* Painted border, not a geometric shape. This is a hand-drawn miniature
          ornament strip, so the footer is edged in actual Indian brushwork. */}
      <div className="relative h-16 w-full overflow-hidden sm:h-20">
        <Image
          src="/images/ornaments/footer-band.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw" quality={70}
          className="object-cover object-center"
        />
      </div>

      {/* ── Threshold: the kalash ────────────────────────────────────────────
          Centred, crowning the entrance, with a lotus either side. This single
          gesture does more for "authentically Indian" than any amount of
          colour. */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-10 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center">
          <Image
            src="/images/ornaments/kalash.jpg"
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover ring-1 ring-haldi/30"
          />
          <p className="mt-3 text-center font-serif text-[11px] uppercase tracking-[0.34em] text-haldi/70">
            Shubh Aarambh · An auspicious beginning
          </p>
        </div>

        <div className="mt-10 grid gap-12 border-t border-rang-paper/10 pt-12 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
          {/* ── Identity field ────────────────────────────────────────────── */}
          <div>
            <Link href="/" className="flex items-center gap-3">
              <svg
                width="30"
                height="30"
                viewBox="0 0 34 34"
                fill="none"
                className="shrink-0 text-haldi"
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
              <span className="font-serif text-2xl font-semibold tracking-tight text-rang-paper">
                SnehaVrinda <span className="text-haldi">Kala</span>
              </span>
            </Link>

            <p className="mt-5 max-w-sm font-serif text-base italic leading-relaxed text-rang-paper/70">
              A house for Indian art, and the hands that make it. Every work
              here carries the name of the person who painted, wove, or shaped
              it.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <span className="h-px w-10 bg-haldi/40" aria-hidden="true" />
              <span className="h-1.5 w-1.5 rotate-45 bg-haldi/60" aria-hidden="true" />
              <span className="h-px w-10 bg-haldi/40" aria-hidden="true" />
            </div>
          </div>

          {/* ── The three fields ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {LINK_GROUPS.map((group) => {
              // Drop platform-only entries (the Artists directory) when the site
              // runs as a single brand, so the footer never links to a page the
              // header has already hidden.
              const links = group.links.filter(
                (link) => platformMode || link.href !== "/artists"
              );

              return (
              <div key={group.heading}>
                <h3 className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-haldi">
                  <span className="h-1 w-1 rotate-45 bg-haldi/70" aria-hidden="true" />
                  {group.heading}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="font-sans text-sm text-rang-paper/70 transition-colors hover:text-haldi"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
          </div>
        </div>

        {/* ── Newsletter, set inside a temple-arch panel ──────────────────── */}
        <div className="mt-14 grid gap-8 rounded-t-2xl border border-b-0 border-rang-paper/15 bg-rang-paper/[0.04] p-7 sm:p-9 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-rang-paper">
              Letters from the art house
            </h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-rang-paper/65">
              New work as it is finished, artist stories, and the occasional
              note on how a tradition actually works. No noise.
            </p>
          </div>

          <form action="/api/newsletter" method="POST" className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                name="email"
                type="email"
                placeholder="Your email"
                aria-label="Your email"
                required
                className="flex-1 rounded-full border border-rang-paper/25 bg-transparent px-4 py-2.5 font-sans text-sm text-rang-paper placeholder:text-rang-paper/40 focus:outline-none focus:ring-1 focus:ring-haldi/60"
              />
              <button
                type="submit"
                className="rounded-full bg-haldi px-6 py-2.5 font-sans text-sm font-semibold text-[#2A120C] transition-colors hover:bg-rang-paper"
              >
                Subscribe
              </button>
            </div>
            <label className="flex items-start gap-2 font-sans text-xs leading-snug text-rang-paper/55">
              <input
                name="consent"
                type="checkbox"
                className="mt-0.5 shrink-0 accent-haldi"
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

      {/* ── The plinth ───────────────────────────────────────────────────────
          A thick band carrying the imprint, the credit, and the legal line,
          the way a carved base carries an inscription. */}
      <div className="relative mt-10 border-t border-rang-paper/10">
        <div className="relative h-10 w-full overflow-hidden">
          <Image
            src="/images/ornaments/footer-band.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw" quality={70}
            className="object-cover object-center opacity-90"
          />
        </div>
        <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 lg:px-12">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <p className="font-serif text-sm text-rang-paper/80">
                © {new Date().getFullYear()} SnehaVrinda Kala. All rights
                reserved.
              </p>
              <p className="mt-1.5 font-sans text-xs tracking-wide text-rang-paper/55">
                Made with care by{" "}
                <span className="font-medium text-haldi">
                  Sneha Sainath Sapa
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-xs text-rang-paper/60">
              <Link href="/about" className="transition-colors hover:text-haldi">
                Our story
              </Link>
              <Link href="/journal" className="transition-colors hover:text-haldi">
                Journal
              </Link>
              <a
                href="mailto:hello@snehavrindakala.example"
                className="transition-colors hover:text-haldi"
              >
                Contact
              </a>
            </div>
          </div>

          <p className="mt-6 text-center font-serif text-[10px] uppercase tracking-[0.3em] text-haldi/40 md:text-left">
            Kala · Sanskrit for art, craft, and skill
          </p>
        </div>
      </div>
    </footer>
  );
}
