"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PaisleyBand, LotusRosette, BelButi, DiyaMotif } from "@/components/indian-motifs";

/**
 * The footer is the **colophon** of a printed catalogue.
 *
 * The previous version stacked a painted band, a photograph of a kalash, a
 * link grid, a newsletter panel, and a second painted band. Five competing
 * beats in a row — it read as a collage, not a composition.
 *
 * This one is a single plate, the way the last page of an art book works:
 *
 *   bel-buti hairline
 *   ┌ the name, enormous, set as type ──────────── the invitation ┐
 *   ├ three columns of quiet links                               │
 *   ├ the newsletter, one line, no panel                          │
 *   └ the imprint and the credit, under a printed rule ───────────┘
 *   paisley band, thick, closing the plate
 *
 * Ornament is a *drawn* system here, not photography: a lotus rosette as the
 * mark, a bel-buti vine under the name, and one paisley band at the foot.
 */
const LINK_GROUPS = [
  {
    heading: "Look",
    links: [
      { label: "All works", href: "/shop" },
      { label: "Art forms", href: "/art-forms" },
      { label: "Artists", href: "/artists" },
      { label: "Journal", href: "/journal" },
    ],
  },
  {
    heading: "Make",
    links: [
      { label: "Commission a piece", href: "/custom-art" },
      { label: "How it works", href: "/custom-art#process" },
      { label: "Our story", href: "/about" },
      { label: "Contact", href: "mailto:hello@snehavrindakala.example" },
    ],
  },
  {
    heading: "Care",
    links: [
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns", href: "/policies/returns" },
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

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative mt-auto overflow-hidden bg-[#2A120C] text-rang-paper">
      {/* Bel-buti hairline: a scrolling vine, the way a manuscript page begins. */}
      <BelButi className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full text-haldi/25" />

      <div className="relative mx-auto max-w-[1400px] px-5 pt-16 sm:px-8 lg:px-12 lg:pt-24">
        {/* ── The plate: name and invitation ──────────────────────────────── */}
        <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <LotusRosette className="h-7 w-7 shrink-0 text-haldi/80" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.34em] text-haldi/80">
                The house of Indian art
              </p>
            </div>

            <p className="mt-7 font-serif text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.03em] text-rang-paper">
              SnehaVrinda
              <br />
              <span className="text-haldi">Kala</span>
            </p>

            <p className="mt-7 max-w-md font-serif text-lg italic leading-relaxed text-rang-paper/60">
              A house for Indian art, and the hands that make it. Every work
              here carries the name of the person who painted, wove, or shaped
              it.
            </p>
          </div>

          {/* The invitation sits opposite the name, as a dedication page might. */}
          <div className="lg:pb-3">
            <h2 className="font-serif text-2xl font-semibold leading-tight text-rang-paper">
              Letters from the art house
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-rang-paper/60">
              New work as it is finished, artist stories, and the occasional
              note on how a tradition actually works.
            </p>

            <form action="/api/newsletter" method="POST" className="mt-6">
              {/* A drawn underline instead of a pill: this is a letter, not a
                  checkout field. */}
              <div className="flex items-end gap-3 border-b border-rang-paper/25 pb-2 focus-within:border-haldi/70">
                <input
                  name="email"
                  type="email"
                  placeholder="Your email"
                  aria-label="Your email"
                  required
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-rang-paper placeholder:text-rang-paper/35 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-haldi transition-colors hover:text-rang-paper"
                >
                  Subscribe
                </button>
              </div>
              <label className="mt-3 flex items-start gap-2 font-sans text-[11px] leading-snug text-rang-paper/45">
                <input
                  name="consent"
                  type="checkbox"
                  className="mt-0.5 shrink-0 accent-haldi"
                  required
                />
                <span>
                  I consent to receive updates. You can unsubscribe anytime.
                </span>
              </label>
            </form>
          </div>
        </div>

        {/* ── The three fields ────────────────────────────────────────────── */}
        <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-rang-paper/12 pt-12 sm:grid-cols-3 lg:mt-20 lg:max-w-4xl">
          {LINK_GROUPS.map((group) => {
            const links = group.links.filter(
              (link) => platformMode || link.href !== "/artists"
            );

            return (
              <div key={group.heading}>
                <h3 className="font-sans text-[10px] font-semibold uppercase tracking-[0.26em] text-haldi/85">
                  {group.heading}
                </h3>
                <ul className="mt-5 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="group/link inline-flex items-center gap-2 font-sans text-sm text-rang-paper/65 transition-colors hover:text-rang-paper"
                      >
                        {/* A small diya appears on hover, as a lamp lit at the
                            link. Purely decorative. */}
                        <span className="h-1 w-1 rounded-full bg-haldi/0 transition-colors group-hover/link:bg-haldi/80" aria-hidden="true" />
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

      {/* ── The imprint, under a printed rule ──────────────────────────────── */}
      <div className="relative mx-auto mt-16 max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-rang-paper/15" />
          <DiyaMotif className="h-4 w-4 shrink-0 text-haldi/70" />
          <span className="h-px flex-1 bg-rang-paper/15" />
        </div>

        <div className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-sans text-xs tracking-wide text-rang-paper/55">
              © {new Date().getFullYear()} SnehaVrinda Kala
            </p>
            <p className="mt-1.5 font-sans text-xs tracking-[0.02em] text-rang-paper/40">
              Made with care by{" "}
              <span className="font-medium text-haldi/85">Sneha Sainath Sapa</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-sans text-xs text-rang-paper/50">
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

        <p className="pb-8 text-center font-serif text-[10px] uppercase tracking-[0.32em] text-haldi/35 sm:text-left">
          Kala · Sanskrit for art, craft, and skill
        </p>
      </div>

      {/* ── Closing band ─────────────────────────────────────────────────────
          One thick painted paisley band ends the plate, the way the foot of a
          manuscript page closes with a border. */}
      <div className="relative">
        <PaisleyBand
          className="pointer-events-none h-14 w-full text-haldi/30 sm:h-16"
        />
        <span className="sr-only">End of footer</span>
      </div>
    </footer>
  );
}
