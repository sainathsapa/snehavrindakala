"use client";

import type { ReactNode } from "react";
import { BelButi, MithilaBorder, LotusRosette, PeacockEye } from "@/components/indian-motifs";

/**
 * Editorial furniture — the parts of a printed art catalogue that make a page
 * feel *published* rather than *built*.
 *
 * A gallery catalogue has a grammar: plate numbers, running heads, marginal
 * notes, drop caps, and a rule under every caption. Those details are why a
 * museum site reads as cultural and a shop reads as commercial, and they cost
 * almost nothing — they are type and hairlines, not decoration.
 */

/* ── Plate number ────────────────────────────────────────────────────────
   "PLATE 03" with a hairline running to the right. Used above a section, a
   work, or an essay. The numbering is what makes a catalogue a catalogue. */
export function PlateNumber({
  number,
  label,
  className = "",
  tone = "ink",
}: {
  number: string | number;
  label?: string;
  className?: string;
  tone?: "ink" | "paper";
}) {
  const text = tone === "paper" ? "text-haldi/80" : "text-terracotta";
  const rule = tone === "paper" ? "bg-haldi/30" : "bg-sand-border";

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden={!label}>
      <span className={`font-sans text-[10px] font-semibold uppercase tracking-[0.3em] ${text}`}>
        Plate{" "}
        <span className="tabular-nums">
          {typeof number === "number" ? String(number).padStart(2, "0") : number}
        </span>
      </span>
      {label && (
        <>
          <span className={`h-px w-6 ${rule}`} aria-hidden="true" />
          <span
            className={`font-sans text-[10px] uppercase tracking-[0.22em] ${
              tone === "paper" ? "text-rang-paper/45" : "text-muted-ink/70"
            }`}
          >
            {label}
          </span>
        </>
      )}
      <span className={`h-px flex-1 ${rule}`} aria-hidden="true" />
    </div>
  );
}

/* ── Drop cap ────────────────────────────────────────────────────────────
   An illuminated initial, floated and set at four lines deep. This single
   device is what separates an essay from a product description. */
export function DropCap({ children }: { children: string }) {
  const first = children.charAt(0);
  const rest = children.slice(1);
  return (
    <p className="font-serif text-lg leading-[1.75] text-deep-ink">
      <span
        className="float-left mr-2 mt-1 font-serif text-[3.4rem] font-semibold leading-[0.78] text-kumkum"
        aria-hidden="true"
      >
        {first}
      </span>
      {/* Keep the screen reader reading the whole word, not the ornate
          first letter in isolation. */}
      <span className="sr-only">{first}</span>
      {rest}
    </p>
  );
}

/* ── Marginal note ───────────────────────────────────────────────────────
   A note set in the outer margin, the way a scholar annotates a catalogue
   raisonné. Collapses below the text on narrow screens. */
export function MarginalNote({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`relative border-l border-terracotta/30 pl-4 font-serif text-sm italic leading-relaxed text-muted-ink ${className}`}
    >
      {children}
    </aside>
  );
}

/* ── Running head ────────────────────────────────────────────────────────
   The repeated title at the top of a printed page. Set as small caps with a
   rule, used at the head of long-form pages. */
export function RunningHead({
  left,
  right,
}: {
  left: string;
  right?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sand-border/70 pb-3">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
        {left}
      </span>
      {right && (
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/60">
          {right}
        </span>
      )}
    </div>
  );
}

/* ── Caption ─────────────────────────────────────────────────────────────
   A museum label: title, maker, medium, then a rule. The order matters — it
   is how every wall label in the world is set. */
export function MuseumLabel({
  title,
  maker,
  medium,
  number,
  className = "",
}: {
  title: string;
  maker?: string;
  medium?: string;
  number?: string | number;
  className?: string;
}) {
  return (
    <div className={`border-t border-sand-border/70 pt-3 ${className}`}>
      {number !== undefined && (
        <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-terracotta/80 tabular-nums">
          {typeof number === "number" ? String(number).padStart(2, "0") : number}
        </span>
      )}
      <p className="mt-1 font-serif text-base font-semibold leading-tight text-deep-ink">
        {title}
      </p>
      <p className="mt-1 font-serif text-sm italic leading-snug text-muted-ink">
        {[maker, medium].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

/* ── Ornamental divider ──────────────────────────────────────────────────
   Three marks in a row — the printed fleuron. Lighter than a rule, more
   deliberate than whitespace. */
export function Fleuron({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  const c = tone === "paper" ? "text-haldi/50" : "text-terracotta/55";
  return (
    <div className={`flex items-center justify-center gap-3 ${c} ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-current opacity-40" />
      <LotusRosette className="h-5 w-5" />
      <span className="h-px w-12 bg-current opacity-40" />
    </div>
  );
}

/* ── Painted rule ────────────────────────────────────────────────────────
   A bel-buti vine standing in for a horizontal rule. Costs one SVG and turns
   a divider into a drawn thing. */
export function PaintedRule({
  className = "",
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "paper";
}) {
  return (
    <BelButi
      aria-hidden="true"
      className={`h-4 w-full ${
        tone === "paper" ? "text-haldi/25" : "text-terracotta/30"
      } ${className}`}
    />
  );
}

/* ── Section pair: essay and plate ───────────────────────────────────────
   The catalogue spread: text on one side, a framed plate on the other, with a
   museum label under the image. This is the single most "art book" layout on
   the site, so it is worth having as a component rather than re-deriving. */
export function EssaySpread({
  plateNumber,
  eyebrow,
  heading,
  children,
  image,
  label,
  reverse = false,
}: {
  plateNumber?: string | number;
  eyebrow?: string;
  heading: ReactNode;
  children: ReactNode;
  image: ReactNode;
  label?: { title: string; maker?: string; medium?: string };
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid items-start gap-10 lg:grid-cols-2 lg:gap-16 ${
        reverse ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div>
        {plateNumber !== undefined && (
          <PlateNumber number={plateNumber} className="mb-6" />
        )}
        {eyebrow && (
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-deep-ink sm:text-4xl">
          {heading}
        </h2>
        <div className="mt-6 space-y-4">{children}</div>
        <MithilaBorder className="mt-8 h-3 w-40 text-terracotta/25" />
      </div>

      <figure>
        {image}
        {label && (
          <figcaption>
            <MuseumLabel {...label} number={plateNumber} />
          </figcaption>
        )}
      </figure>
    </div>
  );
}

/* ── Corner peacock ──────────────────────────────────────────────────────
   One feather's eye tucked into a corner of a section, at very low opacity.
   The kind of detail you notice on the third visit. */
export function CornerPeacock({ className = "" }: { className?: string }) {
  return (
    <PeacockEye
      className={`pointer-events-none absolute h-32 w-24 text-terracotta/[0.09] ${className}`}
    />
  );
}

/* ── Chapter opener ──────────────────────────────────────────────────────
   The device that turns a page of sections into a journey with chapters.

   A brief sets the expectation: every page is a progression — arrive, feel,
   become curious, discover. Without a marker the eye reads a long scroll as
   one undifferentiated thing, no matter how well each block is composed. The
   chapter opener is that marker: a number set large and faint, a title in the
   display face, and one line that says where you are going next.

   It is deliberately quiet. A loud chapter card becomes another UI component;
   this one is closer to a printed folio head — mostly space, one number, one
   rule. */
export function ChapterOpener({
  chapter,
  eyebrow,
  title,
  standfirst,
  align = "left",
  tone = "ink",
  className = "",
}: {
  /**
   * Chapter number, roman numeral or word. Optional: the large pale numeral
   * reads like a printed exhibition catalogue, which is wrong for a shopping
   * page. Editorial spreads can pass it; public pages leave it out.
   */
  chapter?: string | number;
  eyebrow?: string;
  title: ReactNode;
  standfirst?: ReactNode;
  align?: "left" | "center";
  tone?: "ink" | "paper";
  className?: string;
}) {
  const eyebrowTone = tone === "paper" ? "text-haldi/80" : "text-terracotta";
  const titleTone = tone === "paper" ? "text-rang-paper" : "text-deep-ink";
  const bodyTone = tone === "paper" ? "text-rang-paper/70" : "text-muted-ink";
  const numeralTone =
    tone === "paper" ? "text-haldi/[0.16]" : "text-terracotta/[0.13]";
  const ruleTone = tone === "paper" ? "bg-haldi/30" : "bg-sand-border";

  return (
    <div
      className={`${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-3xl"} ${className}`}
    >
      {/* The numeral sits behind the title as a printed watermark, the way a
          folio number sits large and pale at the head of a chapter. */}
      <div className="relative">
        {chapter !== undefined && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -top-8 select-none font-serif text-[92px] font-semibold leading-none sm:-top-10 sm:text-[128px] ${numeralTone} ${
              align === "center" ? "left-1/2 -translate-x-1/2" : "-left-2"
            }`}
          >
            {chapter}
          </span>
        )}
        <div className="relative">
          {eyebrow && (
            <p
              className={`font-sans text-[10px] font-semibold uppercase tracking-[0.3em] ${eyebrowTone}`}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className={`mt-3 font-serif text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.02em] ${titleTone}`}
          >
            {title}
          </h2>
          {standfirst && (
            <p
              className={`mt-4 font-sans text-base leading-relaxed ${bodyTone} ${
                align === "center" ? "mx-auto" : "max-w-xl"
              }`}
            >
              {standfirst}
            </p>
          )}
          <span
            aria-hidden="true"
            className={`mt-7 block h-px w-16 ${ruleTone} ${
              align === "center" ? "mx-auto" : ""
            }`}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Pull quote ──────────────────────────────────────────────────────────
   A line lifted out of the prose and set large. In an art book this is how a
   page breathes: one sentence given the whole width instead of being buried
   in a paragraph. Always italic, always with a drawn mark at the head. */
export function PullQuote({
  children,
  attribution,
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  attribution?: string;
  tone?: "ink" | "paper";
  className?: string;
}) {
  const text = tone === "paper" ? "text-rang-paper" : "text-deep-ink";
  const mark = tone === "paper" ? "text-haldi/60" : "text-terracotta/70";
  const attr = tone === "paper" ? "text-rang-paper/50" : "text-muted-ink/80";

  return (
    <figure className={`relative mx-auto max-w-3xl px-2 ${className}`}>
      <span
        aria-hidden="true"
        className={`block font-serif text-[54px] leading-none ${mark}`}
      >
        &ldquo;
      </span>
      <blockquote
        className={`-mt-6 font-serif text-[clamp(1.35rem,2.8vw,2.05rem)] italic leading-[1.35] ${text}`}
      >
        {children}
      </blockquote>
      {attribution && (
        <figcaption
          className={`mt-5 font-sans text-[10px] font-semibold uppercase tracking-[0.26em] ${attr}`}
        >
          {attribution}
        </figcaption>
      )}
    </figure>
  );
}

/* ── Full-bleed plate ────────────────────────────────────────────────────
   One image, edge to edge, with a caption. The single most effective way to
   break the rhythm of stacked sections: nothing else on the row, so the work
   is unambiguously the subject.

   Rendered as a plain img rather than next/image because the caller usually
   supplies its own picture element or a remote URL; callers that want the
   optimiser pass a next/image child instead. */
export function FullBleedPlate({
  src,
  alt,
  caption,
  credit,
  ratio = "cinema",
  className = "",
}: {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
  ratio?: "cinema" | "wide" | "square" | "portrait";
  className?: string;
}) {
  const ratios: Record<string, string> = {
    cinema: "aspect-[21/9]",
    wide: "aspect-[16/9]",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
  };

  return (
    <figure className={className}>
      <div className={`relative w-full overflow-hidden ${ratios[ratio]}`}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-deep-ink/10"
        />
      </div>
      {(caption || credit) && (
        <figcaption className="mx-auto mt-3 flex max-w-[1400px] flex-wrap items-baseline gap-x-3 px-5 sm:px-8 lg:px-12">
          {caption && (
            <span className="font-serif text-[13px] italic text-muted-ink">
              {caption}
            </span>
          )}
          {credit && (
            <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted-ink/60">
              {credit}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
