"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  PaisleyBand,
  LotusRosette,
  BelButi,
  DiyaMotif,
  MithilaBorder,
} from "@/components/indian-motifs";

/**
 * The footer is the back cover of the catalogue.
 *
 * A printed art book ends with three things: a full-bleed plate, the colophon
 * (how the book was made, by whom), and the address. It does not end with a
 * wall of navigation. So this footer is built as those three bands:
 *
 *   1. THE TRADITIONS — a strip of the six forms as small plates. Even at the
 *      very bottom of the page, the last thing you look at is art.
 *   2. THE COLOPHON  — the name set as type, the letter, the four link columns.
 *   3. THE IMPRINT   — who made it, where to write, the credit.
 *
 * Ornament is drawn SVG (lotus rosette, bel-buti vine, mithila border, diya,
 * paisley band), never clip-art, and every piece is aria-hidden.
 */

const LINK_GROUPS = [
  {
    heading: "Look",
    links: [
      { label: "All works", href: "/shop" },
      { label: "Art forms", href: "/art-forms" },
      { label: "Learn", href: "/learn" },
      { label: "Journal", href: "/journal" },
      { label: "Artists", href: "/artists", platformOnly: true },
    ],
  },
  {
    heading: "Make",
    links: [
      { label: "Request a piece", href: "/custom-art" },
      { label: "How it works", href: "/custom-art#process" },
      { label: "Our story", href: "/about" },
      { label: "Write to us", href: "mailto:hello@snehavrindakala.example" },
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
  traditions = [],
}: {
  /** The Artists directory only exists in platform mode. */
  platformMode?: boolean;
  /** The six art forms, shown as a closing strip of plates. */
  traditions?: { name: string; slug: string; image: string }[];
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative mt-auto overflow-hidden bg-[#2A120C] text-rang-paper">
      {/* ── 1. The traditions strip ─────────────────────────────────────────
          The last thing on the page is the work itself. Six plates, edge to
          edge, each darkening to show its name. This is what makes the foot of
          an art site feel like a gallery wall rather than a sitemap. */}
      {traditions.length > 0 && (
        <section aria-labelledby="footer-traditions" className="relative">
          <h2 id="footer-traditions" className="sr-only">
            The traditions we work with
          </h2>

          <div className="grid grid-cols-3 lg:grid-cols-6">
            {traditions.slice(0, 6).map((form) => (
              <Link
                key={form.slug}
                href={`/art-forms/${form.slug}`}
                className="group relative block aspect-square overflow-hidden sm:aspect-[4/5] lg:aspect-[3/4]"
              >
                <Image
                  src={form.image}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 33vw, 16vw"
                  className="object-cover opacity-85 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-hover:opacity-100"
                />
                {/* A short wash only behind the caption, not the whole plate —
                    covering the image completely made the work look muddy. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#2A120C] to-transparent"
                />
                <span className="absolute inset-x-0 bottom-0 px-2.5 pb-3 pt-6 sm:px-3 sm:pb-4">
                  <span className="block font-serif text-[12px] font-semibold leading-tight text-rang-paper transition-colors group-hover:text-haldi sm:text-[14px]">
                    {form.name}
                  </span>
                </span>
                {/* Hairline between plates, like frames hung side by side. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 w-px bg-[#2A120C]/40"
                />
              </Link>
            ))}
          </div>

          <MithilaBorder className="h-3 w-full text-haldi/30" />
        </section>
      )}

      {/* ── 2. The colophon ─────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-14 sm:px-8 lg:px-12 lg:pt-20">
        <BelButi className="pointer-events-none absolute inset-x-0 top-0 h-4 w-full text-haldi/20" />

        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          {/* Identity and the letter. */}
          <div>
            <div className="flex items-center gap-2.5">
              <LotusRosette className="h-6 w-6 shrink-0 text-haldi/85" />
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.32em] text-haldi/80">
                Kala · art, craft, skill
              </p>
            </div>

            <p className="mt-6 font-serif text-[clamp(2.2rem,5.4vw,4rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
              SnehaVrinda
              <br />
              <span className="text-haldi">Kala</span>
            </p>

            <p className="mt-5 max-w-sm font-serif text-base italic leading-relaxed text-rang-paper/75">
              A house for Indian art, and the hands that make it. Every work
              here carries the name of the person who painted, wove, or shaped
              it.
            </p>

            <form action="/api/newsletter" method="POST" className="mt-8 max-w-sm">
              <label
                htmlFor="footer-email"
                className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-haldi/70"
              >
                Letters from the art house
              </label>
              {/* An underline, not a pill: a letter, not a checkout field. */}
              <div className="mt-2.5 flex items-center gap-3 border-b border-rang-paper/25 pb-2 focus-within:border-haldi/70">
                <input
                  id="footer-email"
                  name="email"
                  type="email"
                  placeholder="Your email"
                  required
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-rang-paper placeholder:text-rang-paper/30 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-haldi transition-colors hover:text-rang-paper"
                >
                  Send
                </button>
              </div>
              <label className="mt-2.5 flex items-start gap-2 font-sans text-[10px] leading-snug text-rang-paper/65">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  className="mt-0.5 h-3 w-3 shrink-0 cursor-pointer appearance-none border border-rang-paper/40 bg-transparent transition-colors checked:border-haldi checked:bg-haldi"
                />
                <span>I agree to receive occasional notes. Unsubscribe anytime.</span>
              </label>
            </form>
          </div>

          {/* The link fields, three tight columns. Spreading them across the
              whole right half left a dead gap in the middle of the footer. */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:pt-2">
            {LINK_GROUPS.map((group) => {
              const links = group.links.filter(
                (link) => platformMode || !("platformOnly" in link)
              );
              return (
                <div key={group.heading}>
                  <h3 className="flex items-center gap-2 font-sans text-[9px] font-semibold uppercase tracking-[0.26em] text-haldi">
                    <span className="h-1 w-1 rotate-45 bg-haldi/60" aria-hidden="true" />
                    {group.heading}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="font-serif text-[15px] text-rang-paper/75 transition-colors hover:text-haldi"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* The right half used to run out after three short columns and
                leave a hole. This closes the block with the one line that
                belongs in a colophon: where to find the house. */}
            <div className="sm:col-span-3 lg:col-span-3">
              <div className="flex flex-col gap-1.5 border-t border-rang-paper/12 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sans text-[11px] leading-relaxed text-rang-paper/55">
                  Bengaluru, India
                  <span className="mx-2 text-rang-paper/25">·</span>
                  <a
                    href="mailto:hello@snehavrindakala.example"
                    className="text-rang-paper/70 transition-colors hover:text-haldi"
                  >
                    hello@snehavrindakala.example
                  </a>
                </p>
                <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-rang-paper/40">
                  Shipping across India
                </p>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* ── 3. The imprint ──────────────────────────────────────────────── */}
      <div className="relative mx-auto mt-14 max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-rang-paper/12" />
          <DiyaMotif className="h-4 w-4 shrink-0 text-haldi/60" />
          <span className="h-px flex-1 bg-rang-paper/12" />
        </div>

        <div className="flex flex-col gap-3 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="font-sans text-[11px] leading-relaxed tracking-[0.02em] text-rang-paper/60">
            © {new Date().getFullYear()} SnehaVrinda Kala · Made with care by{" "}
            <span className="font-medium text-haldi">Sneha Sainath Sapa</span>
          </p>
          <p className="font-serif text-[12px] italic tracking-wide text-rang-paper/55">
            Every work here was made by a hand that learned the form from someone.
          </p>
        </div>
      </div>

      {/* Closing band: one thick paisley frieze, the foot of a manuscript page. */}
      <PaisleyBand className="h-12 w-full text-haldi/25 sm:h-14" />
    </footer>
  );
}
