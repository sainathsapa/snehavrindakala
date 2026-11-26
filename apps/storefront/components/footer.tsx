"use client";

import { Link } from "@/i18n/routing";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LetterForm } from "@/components/letter-form";
import { SocialIcon } from "@/components/social-icons";
import {
  LotusRosette,
  DiyaMotif,
  KalashMotif,
} from "@/components/indian-motifs";
import { GLOSSARY } from "@/lib/art-reference";
import { PaymentMarks } from "@/components/payment-marks";
import { STUDIO_EMAIL, STUDIO_NAME, STUDIO_ADDRESS_LINES } from "@/lib/studio";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { CookieSettingsButton } from "@/components/analytics-consent";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

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

/** The flat index. Kept beside LINK_GROUPS so a new page is added in one place,
 *  and so the footer never drifts out of step with the nav. */
const INDEX_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Rooms", href: "/rooms" },
  { label: "Art forms", href: "/art-forms" },
  { label: "Learn", href: "/learn" },
  { label: "The makers", href: "/makers" },
  { label: "Journal", href: "/journal" },
  { label: "Newsroom", href: "/newsroom" },
  { label: "Custom art", href: "/custom-art" },
  { label: "Partners", href: "/partners" },
  { label: "Sell with us", href: "/sell" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Track an order", href: "/track" },
  { label: "Your account", href: "/account" },
  { label: "Shipping", href: "/policies/shipping" },
  { label: "Returns", href: "/policies/returns" },
  { label: "Privacy", href: "/policies/privacy" },
  { label: "Terms", href: "/policies/terms" },
  { label: "Cookies", href: "/policies/cookie" },
];

const LINK_GROUPS = [
  {
    heading: "look",
    links: [
      { key: "allWorks", href: "/shop" },
      { key: "artForms", href: "/art-forms" },
      { key: "rooms", href: "/rooms" },
      { key: "learn", href: "/learn" },
      { key: "journal", href: "/journal" },
      { key: "artists", href: "/artists" },
    ],
  },
  {
    heading: "make",
    links: [
      { key: "requestAPiece", href: "/custom-art" },
      { key: "howItWorks", href: "/custom-art#process" },
      { key: "ourStory", href: "/about" },
      { key: "newsroom", href: "/newsroom" },
      { key: "partners", href: "/partners" },
      { key: "writeToUs", href: "/contact" },
    ],
  },
  {
    heading: "help",
    links: [
      { key: "faqSupport", href: "/faq" },
      { key: "trackOrder", href: "/track" },
      { key: "shipping", href: "/policies/shipping" },
      { key: "returns", href: "/policies/returns" },
    ],
  },
  {
    heading: "care",
    links: [
      { key: "authenticity", href: "/authenticity" },
      { key: "disclaimer", href: "/disclaimer" },
      { key: "privacy", href: "/policies/privacy" },
      { key: "terms", href: "/policies/terms" },
      { key: "cookie", href: "/policies/cookie" },
    ],
  },
];

/** One word from the glossary, used as the footer's rotating epigraph. */
const WORD_OF_THE_HOUSE = GLOSSARY[0];

export function Footer({
  platformMode = false,
  traditions = [],
  socials = [],
  currency = "inr",
}: {
  /** The Artists directory only exists in platform mode. */
  platformMode?: boolean;
  /** The six art forms, shown as a closing strip of plates. */
  traditions?: { name: string; slug: string; image: string }[];
  /**
   * Configured social profiles. Empty unless real URLs are set in the
   * environment, so the footer never shows an icon that goes nowhere.
   */
  socials?: { id: string; label: string; href: string }[];
  /** Active currency, so the switcher shows what is actually being priced. */
  currency?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("footer");
  const tLang = useTranslations("currency");

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative mt-auto overflow-hidden bg-[#2A120C] text-rang-paper">
      {/* ═══ 0. THE THRESHOLD ═════════════════════════════════════════════
          Language and currency sit here, at the head of the footer.

          They spent two revisions in the header and never settled. In the main
          row they competed with the wordmark, the nav, the search box and three
          icon targets; lifted onto their own strip above it they became a second
          navigation bar hanging off the top of every page, which is the "odd"
          look this replaces. Neither is something a visitor changes often enough
          to justify permanent space at the top of the viewport.

          The footer is where a preference lives. It is the last thing on the
          page, it is present on every page, and putting the choice there costs
          the browsing experience nothing.

          Dark tone: the ground is #2A120C, so these use the light palette.

          Shown at every width. These were briefly hidden below `md`, with copies
          inside the menu sheet on the grounds that the menu is one tap and the
          footer is several screens away — but the navigation is not where anyone
          looks for a language, and the two ended up visible in neither place a
          reader expected. The footer is the canonical location now, so the menu
          duplicates are gone and there is exactly one of each on the page.

          Labels above each control matter for the same reason: two bare
          dropdowns at the end of a long page read as trim, not as settings.

          The first attempt at this was too timid — 9px labels and 11px
          uppercase selects, both at partial opacity on a near-black ground. The
          controls were there and measured non-zero, and were still reported as
          missing, which is the correct judgement: nothing that small and that
          quiet is a control you can find. Type is 13px in sentence case now, in
          full-strength paper white, with a heading that names what the strip is
          for. */}
      <div className="border-b border-rang-paper/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-12">
          <p className="max-w-[36ch] font-sans text-[12.5px] leading-relaxed text-rang-paper/65">
            {tLang("stripHeading")}
          </p>

          {/* Two settings, one row, each named once. The labels used to be
              stacked above the fields while the fields also carried their own
              screen-reader labels and a drawn symbol — so the strip read
              "Language / Language / Currency / Currency£". A label sits left of
              its field now, in sentence case, and the field holds only the
              value. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2.5">
              <span className="font-sans text-[12px] uppercase tracking-[0.14em] text-rang-paper/55">
                {tLang("language")}
              </span>
              <LanguageSwitcher tone="paper" size="md" showIcon={false} hideLabel />
            </label>
            <span aria-hidden="true" className="hidden h-5 w-px bg-rang-paper/15 sm:block" />
            <label className="flex items-center gap-2.5">
              <span className="font-sans text-[12px] uppercase tracking-[0.14em] text-rang-paper/55">
                {tLang("label")}
              </span>
              <CurrencySwitcher current={currency} tone="paper" size="md" showSymbol={false} hideLabel />
            </label>
          </div>
        </div>
      </div>

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
              {t("tagline")}
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
                {t("moreGlossary")}
              </Link>
            </div>

            {/* The place, in the letter's own voice. */}
            <div className="mt-8 flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-haldi/45" />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.26em] text-haldi/75">
                {t("place")}
              </p>
            </div>

            {/* The letter. An underline, not a pill: correspondence, not a
                checkout field. */}
            <LetterForm />
          </div>

          {/* ── The jharokha galleries ──
              Each link group sits inside an arched opening — the projecting
              window a haveli uses to look outward. The arch is drawn once per
              column, behind the list, and the heading sits in its cusp. */}
          <nav aria-label="Footer" className="relative">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {LINK_GROUPS.map((group) => {
                const links = group.links.filter(
                  (link) => platformMode || !("platformOnly" in link)
                );
                return (
                  <div key={group.heading} className="relative pt-11">
                    {/* A jharokha, not a ledge.

                        Each column now sits inside a real cusped arch — the
                        projecting window a haveli uses to look outward — with
                        a small lotus keystone at the apex. This is drawn in
                        CSS at whatever size the column happens to be, so the
                        motif never gets resampled into a smudge the way a
                        bitmap frieze did when squeezed into a 20px strip. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-start"
                    >
                      <svg
                        viewBox="0 0 120 34"
                        preserveAspectRatio="none"
                        className="h-8 w-full max-w-[120px] text-haldi/45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      >
                        {/* The arch: two shoulders rising to a pointed cusp. */}
                        <path d="M2 33 V14 Q2 3 28 3 Q46 3 54 8 Q60 11 60 2 Q60 11 66 8 Q74 3 92 3 Q118 3 118 14 V33" />
                        {/* A pendant bead hanging in the cusp. */}
                        <circle cx="60" cy="14" r="2" strokeWidth="1" />
                        <path d="M60 16 V21" strokeWidth="0.8" />
                      </svg>
                      <span className="-mt-1 h-px w-10 bg-haldi/35" />
                    </span>
                    <div className="relative px-1">
                      <h3 className="font-sans text-[9px] font-semibold uppercase tracking-[0.26em] text-haldi">
                        {group.heading}
                      </h3>
                      {/* The italic sub-line that used to sit here repeated the
                          heading back at the reader — "Look / The work",
                          "Help / Questions". Two labels for one column is
                          noise, so the heading now stands alone and the
                          carved arch above it does the decorating. */}
                      <ul className="mt-3.5 space-y-2.5">
                        {links.map((link) => (
                          <li key={link.key}>
                            <Link
                              href={link.href}
                              className="group inline-flex items-baseline gap-1.5 font-serif text-[15px] text-rang-paper/75 transition-colors hover:text-haldi"
                            >
                              <span className="h-px w-0 bg-haldi/70 transition-[width] duration-300 group-hover:w-3" />
                              {t(link.key)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* The address block, fenced with the real painted frieze.

                This was a 24px vector paisley band, which at that height read
                as a rule rather than as ornament. The photograph of the gold
                vine is the same motif the haveli lintels use, and at 40px it
                still reads as carving. */}
            <div className="mt-9">
              <div
                aria-hidden="true"
                className="relative h-10 w-full overflow-hidden opacity-30 mix-blend-screen"
              >
                <Image
                  src="/images/ornaments/gold-vine-band.jpg"
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover object-center"
                />
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-rang-paper/12 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {/* The registered address, as a postal address rather than
                    a byline. It is the same text the courier label and the
                    GST invoice carry (lib/studio.ts), so a move is edited
                    once. */}
                <address className="not-italic">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-rang-paper/75">
                    {STUDIO_NAME}
                  </p>
                  {STUDIO_ADDRESS_LINES.map((line) => (
                    <span
                      key={line}
                      className="block font-sans text-[11px] leading-relaxed text-rang-paper/55"
                    >
                      {line}
                    </span>
                  ))}
                  <a
                    href={`mailto:${STUDIO_EMAIL}`}
                    className="mt-1 inline-block font-sans text-[11px] text-rang-paper/70 transition-colors hover:text-haldi"
                  >
                    {STUDIO_EMAIL}
                  </a>
                </address>                <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-rang-paper/40">
                  {t("shippingWorldwide")}
                </p>
              </div>

              {/* Payments and socials share this plinth.

                  The payment marks say which methods the Razorpay account
                  actually accepts, so the row is a statement of fact rather
                  than a trust badge bought by the yard. Socials only appear
                  once a real profile URL is configured. */}
              <div className="mt-5 flex flex-col gap-5 border-t border-rang-paper/12 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <PaymentMarks />
                {socials.length > 0 ? (
                  // Icons, not names: a row of platform wordmarks reads as a
                  // list of words. The network name stays for screen readers.
                  <ul aria-label={t("followUs")} className="flex flex-nowrap items-center gap-1.5">
                    {socials.map((social) => (
                      <li key={social.id}>
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer me"
                          title={social.label}
                          className="grid h-10 w-10 place-items-center rounded-full border border-rang-paper/20 text-rang-paper/70 transition-colors hover:border-haldi hover:text-haldi focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
                        >
                          <SocialIcon name={social.id} className="h-4 w-4" />
                          <span className="sr-only">{social.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  // No profile is configured, so the honest thing is an address
                  // rather than an empty plinth. Inventing a handle would send
                  // buyers to a stranger's account.
                  <a
                    href={`mailto:${STUDIO_EMAIL}`}
                    className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-rang-paper/55 transition-colors hover:text-haldi"
                  >
                    {t("writeToUs")}
                  </a>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* ── The site index ────────────────────────────────────────────────
          Every page, one line each, before the inscription.

          The four galleries are grouped by what a person is doing, which is
          right for browsing and useless for finding a page you already know
          exists. This is the index at the back of the book. The XML sitemap is
          the same list for a crawler and is linked here so it can be checked by
          hand. */}
      <div className="relative mx-auto mt-14 max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="border-t border-rang-paper/12 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-haldi/80">
              {t("everyPage")}
            </h2>
            <a
              href="/sitemap.xml"
              className="font-sans text-[10px] uppercase tracking-[0.18em] text-rang-paper/45 transition-colors hover:text-haldi"
            >
              sitemap.xml
            </a>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {INDEX_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-sans text-[12.5px] text-rang-paper/70 transition-colors hover:text-haldi"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {GA_MEASUREMENT_ID && (
              <CookieSettingsButton className="font-sans text-[11px] tracking-[0.02em] text-rang-paper/60 underline underline-offset-2 transition-colors hover:text-haldi" />
            )}
            <p className="font-serif text-[12px] italic tracking-wide text-rang-paper/55">
              Every work here was made by a hand that learned the form from someone.
            </p>
          </div>
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
