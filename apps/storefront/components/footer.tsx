"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LotusRosette,
  DiyaMotif,
  KalashMotif,
  PaisleyBand,
} from "@/components/indian-motifs";
import { GLOSSARY } from "@/lib/art-reference";

/**
 * The footer is the facade of the house.
 *
 * Most footers are a filing cabinet: four columns of links, a legal line, a
 * grey strip. This one is built the way a Bikaner haveli is built, from the
 * ground up, and each architectural element does a real job:
 *
 *   1. THE GALLERY     — the six traditions hung edge to edge. The last thing
 *                        you see is the work, not a sitemap.
 *   2. THE LINTEL      — the carved gold-and-burgundy panel, given real
 *                        height so its lotus frieze can be read. A rosette
 *                        rides the seam as a keystone.
 *   3. THE JHAROKHA    — the link columns are set inside arched openings, the
 *                        projecting windows a haveli uses to look outward.
 *                        That is exactly what a footer nav is doing.
 *   4. THE INSCRIPTION — the maker's line, cut into the stone.
 *   5. THE PLINTH      — the ornament band again as a base, with the kalash
 *                        at centre: the vessel that marks a threshold.
 *
 * ORNAMENT IS ART, NOT LINE-WORK.
 * An earlier version closed on 1px SVG rules and a 12px paisley band. At that
 * size a drawn motif reads as a divider, and the eye gets a hairline where it
 * wants a frieze. So the ornament here is the real gold-on-burgundy panel in
 * public/images/ornaments, at a height where you can see what it is.
 *
 * The house is in Bikaner, Rajasthan. Every plate, every arched opening and
 * every line of address says so.
 */

const LINK_GROUPS = [
  {
    heading: "Look",
    sub: "The work",
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
    sub: "The commission",
    links: [
      { label: "Request a piece", href: "/custom-art" },
      { label: "How it works", href: "/custom-art#process" },
      { label: "Our story", href: "/about" },
      { label: "Write to us", href: "mailto:hello@snehavrinda.in" },
    ],
  },
  {
    heading: "Care",
    sub: "The house",
    links: [
      { label: "Authenticity", href: "/authenticity" },
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns", href: "/policies/returns" },
      { label: "Privacy", href: "/policies/privacy" },
      { label: "Terms", href: "/policies/terms" },
    ],
  },
];

/** One word from the glossary, used as the footer's rotating epigraph. */
const WORD_OF_THE_HOUSE = GLOSSARY[0];

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
      {/* ═══ 1. THE GALLERY ═══════════════════════════════════════════════
          Six plates, edge to edge. The last thing on the page is the work. */}
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
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#2A120C] to-transparent"
                />
                <span className="absolute inset-x-0 bottom-0 px-2.5 pb-3 pt-6 sm:px-3 sm:pb-4">
                  <span className="block font-serif text-[12px] font-semibold leading-tight text-rang-paper transition-colors group-hover:text-haldi sm:text-[14px]">
                    {form.name}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 w-px bg-[#2A120C]/40"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 2. THE LINTEL ════════════════════════════════════════════════
          The carved panel, at a height where the lotus frieze reads. The image
          is a framed panel (1400×790), not a thin strip, so it is given real
          height: a threshold, not a rule. object-cover keeps the medallions
          round across widths.

          The scrims deepen the panel's own burgundy into the footer's, so it
          melts into the page and the gold is what survives. */}
      <div className="relative">
        {/* object-cover on a 1440×224 box would slice a horizontal strip out of
            a 1400×790 panel — you would see one row of the frieze and lose the
            lotus band that makes it ornament. object-contain keeps the whole
            composition intact and lets the panel's own burgundy margins bleed
            into the footer, which is what a real carved band does at a seam. */}
        <div className="relative h-32 w-full overflow-hidden sm:h-44 lg:h-52">
          <Image
            src="/images/ornaments/footer-band.jpg"
            alt=""
            fill
            aria-hidden="true"
            sizes="100vw"
            priority={false}
            className="object-cover object-[50%_46%]"
          />
          {/* Only the outer edges are darkened, and lightly. The panel's own
              ground is already burgundy close to the footer's, so it needs a
              seam, not a scrim — any stronger and the gold leaf stops reading
              as gold and turns into a smudge. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-[#2A120C] to-transparent"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#2A120C] to-transparent"
          />
          {/* Gold hairline at the seam, where carving meets plaster. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-haldi/45 to-transparent"
          />
        </div>

        {/* The keystone rosette straddling the seam. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex translate-y-1/2 justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-haldi/30 bg-[#2A120C] shadow-[0_0_0_7px_#2A120C] sm:h-20 sm:w-20">
            <LotusRosette className="h-8 w-8 text-haldi/90 sm:h-10 sm:w-10" />
          </span>
        </div>
      </div>

      {/* ═══ 3. THE COLOPHON ══════════════════════════════════════════════ */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-16 sm:px-8 lg:px-12 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* ── The letter ── */}
          <div>
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.32em] text-haldi/80">
              Kala · art, craft, skill
            </p>

            <p className="mt-5 font-serif text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[0.92] tracking-[-0.03em]">
              SnehaVrinda
              <br />
              <span className="text-haldi">Kala</span>
            </p>

            <p className="mt-5 max-w-sm font-serif text-base italic leading-relaxed text-rang-paper/75">
              A house for Indian art, and the hands that make it. Every work
              here carries the name of the person who painted, wove, or shaped
              it.
            </p>

            {/* The word of the house — a glossary term, so the footer teaches
                one thing before you leave. This is the difference between a
                colophon and a copyright strip. */}
            <div className="mt-8 max-w-sm border-l border-haldi/25 pl-4">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-serif text-lg font-semibold text-haldi">
                  {WORD_OF_THE_HOUSE.term}
                </span>
                <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-rang-paper/45">
                  {WORD_OF_THE_HOUSE.language}
                </span>
              </p>
              <p className="mt-1.5 font-serif text-[13px] italic leading-relaxed text-rang-paper/65">
                {WORD_OF_THE_HOUSE.meaning}
              </p>
              <Link
                href="/learn"
                className="mt-2 inline-block font-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-haldi/75 transition-colors hover:text-haldi"
              >
                More in the glossary →
              </Link>
            </div>

            {/* The place, in the letter's own voice. */}
            <div className="mt-8 flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-haldi/45" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.26em] text-haldi/75">
                Bikaner · Rajasthan
              </p>
            </div>

            {/* The letter. An underline, not a pill: correspondence, not a
                checkout field. */}
            <form action="/api/newsletter" method="POST" className="mt-8 max-w-sm">
              <label
                htmlFor="footer-email"
                className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-haldi/70"
              >
                Letters from the art house
              </label>
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

          {/* ── The jharokha galleries ──
              Each link group sits inside an arched opening — the projecting
              window a haveli uses to look outward. The arch is drawn once per
              column, behind the list, and the heading sits in its cusp. */}
          <nav aria-label="Footer" className="relative">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {LINK_GROUPS.map((group) => {
                const links = group.links.filter(
                  (link) => platformMode || !("platformOnly" in link)
                );
                return (
                  <div key={group.heading} className="relative pt-8">
                    {/* A cut-stone ledge above each column.

                        This used to be the ornament image squeezed into a
                        206×20 box. Next serves that at w=256, so a 1400px dense
                        frieze was being resampled down to about a fifth of its
                        width: the lotus and vine became an indistinct gold
                        smudge, which is what made the whole footer read as
                        "simple geometric shapes". A repeating motif cannot
                        survive that, so the ledge is drawn at its real size in
                        CSS instead — a gold rule with a diamond at its centre
                        and a hairline below, which is what a carved ledge
                        actually looks like in section. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1.5"
                    >
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-haldi/45" />
                      <span className="h-1.5 w-1.5 rotate-45 border border-haldi/60" />
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-haldi/45" />
                    </span>
                    <div className="relative px-1">
                      <h3 className="font-sans text-[9px] font-semibold uppercase tracking-[0.26em] text-haldi">
                        {group.heading}
                      </h3>
                      <p className="mt-1 font-serif text-[11px] italic leading-snug text-rang-paper/40">
                        {group.sub}
                      </p>
                      <ul className="mt-3.5 space-y-2.5">
                        {links.map((link) => (
                          <li key={link.label}>
                            <Link
                              href={link.href}
                              className="group inline-flex items-baseline gap-1.5 font-serif text-[15px] text-rang-paper/75 transition-colors hover:text-haldi"
                            >
                              <span className="h-px w-0 bg-haldi/70 transition-[width] duration-300 group-hover:w-3" />
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* The address block, fenced with drawn paisley rather than a
                plain rule. */}
            <div className="mt-9">
              <PaisleyBand className="h-6 w-full text-haldi/25" />
              <div className="mt-4 flex flex-col gap-2 border-t border-rang-paper/12 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sans text-[11px] leading-relaxed text-rang-paper/55">
                  Bikaner, Rajasthan, India
                  <span className="mx-2 text-rang-paper/25">·</span>
                  <a
                    href="mailto:hello@snehavrinda.in"
                    className="text-rang-paper/70 transition-colors hover:text-haldi"
                  >
                    hello@snehavrinda.in
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

      {/* ═══ 4. THE INSCRIPTION ═══════════════════════════════════════════ */}
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

      {/* ═══ 5. THE PLINTH ════════════════════════════════════════════════
          The ornament returns as the base the page rests on, cropped lower so
          it reads as a plinth rather than a repeat of the lintel. The kalash
          sits at centre — the vessel that marks a threshold, and the last mark
          on the page. */}
      <div className="relative">
        <div className="relative h-28 w-full overflow-hidden sm:h-32 lg:h-40">
          <Image
            src="/images/ornaments/footer-band.jpg"
            alt=""
            fill
            aria-hidden="true"
            sizes="100vw"
            className="object-cover object-bottom"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#2A120C] to-transparent"
          />
        </div>

        {/* The kalash, seated on the plinth. */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div className="relative flex translate-y-[18%] flex-col items-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2A120C] shadow-[0_0_0_1px_rgba(240,196,91,0.35)] sm:h-24 sm:w-24">
              <KalashMotif className="h-11 w-11 text-haldi/85 sm:h-14 sm:w-14" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
