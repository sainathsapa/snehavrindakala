import type { CSSProperties } from "react";

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
          {variant === "jaali" && <JaaliField />}
          {variant === "buti" && <ButiField />}
          <PaperGrain />
        </>
      )}
      <div className="relative">{children}</div>
    </Tag>
  );
}
