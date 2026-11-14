import type { CSSProperties } from "react";
import Image from "next/image";

/**
 * Page-level ornament.
 *
 * The site had a rich homepage and then, on every interior page, a flat
 * parchment field: no texture, no border, nothing behind the text. A survey of
 * the rendered pages confirmed it — zero elements on the whole site carried a
 * background image or pattern outside the homepage, and /journal and /about
 * shipped with one or two images between them.
 *
 * These are the ground layers that fix that. They are drawn in CSS so they cost
 * no image requests, scale to any viewport, and can be tinted per page:
 *
 *  - **Jaali**    — the pierced stone screen. A 45° lattice, the thing you see
 *                   through in every Rajasthani haveli. Used as a faint field.
 *  - **Buti**     — the scattered single flower of block-printed cloth. Small,
 *                   regular, and it reads as fabric rather than wallpaper.
 *  - **Pattachitra** — ruled bands, the horizontal register lines that divide a
 *                   painted scroll into episodes. Used to band a section.
 *  - **Grain**    — paper fibre. A tiny amount of noise so the parchment is
 *                   never a flat digital fill.
 *
 * Everything is aria-hidden and pointer-events-none: this is ground, not
 * content. Opacity is kept low deliberately — ornament you notice before the
 * text is ornament that is doing the wrong job.
 */

type GroundProps = {
  className?: string;
  /** Tint the pattern. Defaults to the terracotta ink at low opacity. */
  style?: CSSProperties;
};

/* ── Paper grain ───────────────────────────────────────────────────────────
   Noise, not a picture. Two overlapping radial gradients at a sub-pixel scale
   give the parchment a fibre without shipping a texture file. */
export function PaperGrain({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 18% 24%, rgba(66,23,15,0.035) 0 1px, transparent 1px),
          radial-gradient(circle at 72% 61%, rgba(66,23,15,0.03) 0 1px, transparent 1px),
          radial-gradient(circle at 41% 88%, rgba(66,23,15,0.028) 0 1px, transparent 1px)
        `,
        backgroundSize: "17px 17px, 23px 23px, 31px 31px",
      }}
    />
  );
}

/* ── Jaali lattice ─────────────────────────────────────────────────────────
   Two crossed 45° line sets make the diamond grid of a pierced screen. The
   spacing is wide (22px) because a tight jaali behind body copy vibrates. */
export function JaaliField({ className = "", style }: GroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `
          repeating-linear-gradient(45deg, rgba(123,16,25,0.055) 0 1px, transparent 1px 22px),
          repeating-linear-gradient(-45deg, rgba(123,16,25,0.055) 0 1px, transparent 1px 22px)
        `,
        ...style,
      }}
    />
  );
}

/* ── Buti flowers ──────────────────────────────────────────────────────────
   The scattered flower of hand block-print. Built from a radial dot with a
   soft halo, repeated on an offset grid so it never lines up into stripes. */
export function ButiField({ className = "", style }: GroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(183,70,32,0.10) 0 1.5px, transparent 1.5px),
          radial-gradient(circle at 50% 50%, rgba(123,16,25,0.06) 0 1px, transparent 1px)
        `,
        backgroundSize: "52px 52px, 52px 52px",
        backgroundPosition: "0 0, 26px 26px",
        ...style,
      }}
    />
  );
}

/* ── Scroll registers ──────────────────────────────────────────────────────
   A Pattachitra divides its cloth into horizontal registers with ruled lines.
   Used as a section band it gives a page the structure of a painted scroll
   rather than the flat top-to-bottom of a web page. */
export function RegisterBand({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none w-full ${className}`}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-terracotta/35 to-transparent" />
      <div className="mt-1 h-px w-full bg-gradient-to-r from-transparent via-terracotta/20 to-transparent" />
    </div>
  );
}

/**
 * Real-image ornament.
 *
 * The CSS grounds above are economical but they are still flat: crossed rules
 * and radial dots. At any size you can read them as generated shapes, which is
 * the one thing a craft site cannot look like. These components swap in actual
 * painted and photographed ornament — a gold vine frieze, a paisley, a carved
 * sandstone jaali — so the decoration has the irregularity of something made by
 * hand.
 *
 * All are decorative `alt=""` layers, absolutely positioned behind content.
 */

/** The gold-on-burgundy vine frieze, used to close a section. */
export function GoldVineBand({
  className = "",
  height = 64,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <Image
        src="/images/ornaments/gold-vine-band.jpg"
        alt=""
        width={1400}
        height={64}
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}

/**
 * A carved jaali screen filling the given box.
 *
 * Tinted back with a warm wash so it stays ground rather than subject: at full
 * opacity the sandstone reads as a photograph someone dropped on the page.
 */
export function JaaliScreen({
  className = "",
  opacity = 0.16,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <Image
        src="/images/ornaments/jaali-arch.jpg"
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover object-top"
      />
    </div>
  );
}

/** A single painted paisley, sized by the caller. */
export function PaisleyMark({
  className = "",
  rotate = 0,
  opacity = 0.2,
}: {
  className?: string;
  rotate?: number;
  opacity?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/paisley-motif.jpg"
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, opacity }}
    />
  );
}

/**
 * The ground stack: grain over a tint field. Wraps a section so the ornament
 * sits behind its content and never fights it for attention.
 *
 * Usage is deliberately one line:
 *   <OrnamentGround variant="jaali"> …content… </OrnamentGround>
 */
export function OrnamentGround({
  children,
  variant = "jaali",
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  variant?: "jaali" | "buti" | "grain" | "none";
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag className={`relative ${className}`}>
      {variant !== "none" && (
        <>
          {variant === "jaali" && <JaaliScreen />}
          {variant === "buti" && <ButiField />}
          <PaperGrain />
        </>
      )}
      <div className="relative">{children}</div>
    </Tag>
  );
}

/**
 * A painted kalash (the ceremonial pot) used as a section seal.
 *
 * The site's ornament is photographed pigment rather than vector approximations,
 * so it carries the medium into pages that are otherwise all type — the cart,
 * checkout and account screens. Kept out of the way of text: it is a margin mark,
 * not a watermark, and is hidden from assistive tech.
 */
export function KalashMark({
  className = "",
  opacity = 0.14,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/kalash.jpg"
      className={`pointer-events-none select-none ornament-fade mix-blend-multiply ${className}`}
      style={{ opacity }}
    />
  );
}

/**
 * A repeating band of painted paisley, for closing a section.
 *
 * Tiled from the single motif so one asset covers any width; the alternative was
 * exporting four fixed-width strips per breakpoint.
 */
export function PaisleyBand({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none h-4 w-full ${className}`}
      style={{
        backgroundImage: "url(/images/ornaments/paisley-motif.jpg)",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        opacity: 0.22,
      }}
    />
  );
}

/**
 * Painted assets for the site's ornament: lotus, peacock, mandala, a running
 * floral band and a corner flourish.
 *
 * These are photographed pigment, not vector approximations of it, because the
 * difference is the whole point — a site selling hand-painted work should not
 * dress itself in flat geometry. All are decorative only, so each is hidden from
 * assistive tech and marked `alt=""`.
 */
export function LotusMark({
  className = "",
  opacity = 0.16,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/lotus.jpg"
      className={`pointer-events-none select-none ornament-fade mix-blend-multiply ${className}`}
      style={{ opacity }}
    />
  );
}

export function PeacockMark({
  className = "",
  opacity = 0.14,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/peacock.jpg"
      className={`pointer-events-none select-none ornament-fade mix-blend-multiply ${className}`}
      style={{ opacity }}
    />
  );
}

export function MandalaMark({
  className = "",
  opacity = 0.12,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/mandala.jpg"
      className={`pointer-events-none select-none ornament-fade mix-blend-multiply ${className}`}
      style={{ opacity }}
    />
  );
}

/** A running floral frieze, for setting off a heading or closing a section. */
export function FloralBand({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none h-6 w-full ${className}`}
      style={{
        backgroundImage: "url(/images/ornaments/floral-band.jpg)",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        opacity: 0.3,
      }}
    />
  );
}

/** A painted corner flourish, pinned to whichever corner `className` places it. */
export function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden="true"
      alt=""
      src="/images/ornaments/corner-flourish.jpg"
      className={`pointer-events-none select-none ornament-fade mix-blend-multiply ${className}`}
      style={{ opacity: 0.18 }}
    />
  );
}
