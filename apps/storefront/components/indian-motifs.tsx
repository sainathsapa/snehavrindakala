/**
 * Indian visual vocabulary.
 *
 * The storefront's "Indian" flavour was living entirely in colour and a single
 * mandala outline. Real Indian visual culture is built from a handful of
 * repeating geometric systems, and a site feels authentic when those systems are
 * actually present rather than suggested. Each motif here is a faithful,
 * simplified drawing of a real form:
 *
 *  - **Kolam** — the Tamil threshold drawing, made by pulling rice flour between
 *    the fingers around a dot grid. Always a closed loop, never a filled shape.
 *  - **Warli** — the Maharashtra tribal idiom: triangles and circles, white on
 *    earth, figures built from two triangles meeting at a point.
 *  - **Pichwai** — the Nathdwara temple cloth: lotus, cows, and a dense
 *    decorative border around a central field.
 *  - **Jali** — the pierced stone screen: geometry on a rotating grid, used at
 *    the Taj and in every Rajasthani haveli.
 *  - **Kalash** — the auspicious pot with mango leaves and a coconut, the form
 *    that opens most Indian ceremonies.
 *  - **Paisley / ambi** — the mango motif that travelled from Persia into
 *    Kashmiri shawls and became the universal Indian decorative unit.
 *
 * All are `aria-hidden`: they are atmosphere, not content. All use
 * `currentColor` so a section can tint them, and all are static.
 */
import type { CSSProperties } from "react";

const decorative: CSSProperties = { pointerEvents: "none" };

type MotifProps = {
  className?: string;
  /** Opacity multiplier for tinting without changing the caller's class. */
  style?: CSSProperties;
};

/* ── Kolam ─────────────────────────────────────────────────────────────────
   A dot grid with a single looping line woven around it. The stiffness of the
   loop is the point — a kolam is drawn in one continuous movement. */
export function KolamMotif({ className = "", style }: MotifProps) {
  const dots: Array<[number, number]> = [];
  // 5×5 pulli grid, evenly spaced.
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      dots.push([24 + x * 18, 24 + y * 18]);
    }
  }

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.4" fill="currentColor" opacity="0.55" />
      ))}
      {/* The loop: four petals wound around the outer ring of dots. */}
      <path
        d="M24 42c0-10 8-18 18-18s18 8 18 18M96 42c0-10-8-18-18-18S60 32 60 42
           M24 78c0 10 8 18 18 18s18-8 18-18M96 78c0 10-8 18-18 18S60 88 60 78"
        stroke="currentColor"
        pathLength={1}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M42 24c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18z
           M78 24c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.7"
      />
      <circle cx="60" cy="60" r="9" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="2.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/* ── Warli figure ─────────────────────────────────────────────────────────
   Two triangles meeting at a point — the canonical Warli body — inside a
   circle, with the tarpa spiral at its centre. */
export function WarliMotif({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      {/* Figure: head, then the two-triangle torso. */}
      <circle cx="60" cy="26" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M60 33 L38 62 L82 62 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M60 45 L44 78 L76 78 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      {/* Arms raised, hands as dots. */}
      <path d="M44 52 L26 38M76 52 L94 38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="25" cy="37" r="2.2" fill="currentColor" />
      <circle cx="95" cy="37" r="2.2" fill="currentColor" />
      {/* Legs. */}
      <path d="M50 78 L42 96M70 78 L78 96" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* The tarpa spiral — the dance that spirals around the musician. */}
      <path
        d="M60 88a6 6 0 106 6 12 12 0 10-12-12 18 18 0 1018 18"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
    </svg>
  );
}

/* ── Paisley band ─────────────────────────────────────────────────────────
   The ambi, repeated as a frieze. Used to edge a band. */
export function PaisleyBand({ className = "", style }: MotifProps) {
  const one = (x: number) => (
    <g key={x} transform={`translate(${x} 0)`}>
      <path
        d="M0 40c0-14 10-24 20-24s16 8 16 16c0 6-4 10-9 10 3-5 2-10-2-12-5-3-13 3-13 12
           -9 0-12-6-12-14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        transform="rotate(14 18 30)"
      />
      <circle cx="22" cy="27" r="1.6" fill="currentColor" opacity="0.6" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 200 60"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {[6, 46, 86, 126, 166].map(one)}
    </svg>
  );
}

/* ── Jali screen ──────────────────────────────────────────────────────────
   A pierced-lattice field on a 45° grid: the geometry of Rajasthani screens,
   used as a texture rather than an image. */
export function JaliPattern({ className = "", style, id = "jali" }: MotifProps & { id?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <g stroke="currentColor" strokeWidth="1" fill="none">
            <path d="M28 0 L56 28 L28 56 L0 28 Z" />
            <path d="M28 12 L44 28 L28 44 L12 28 Z" opacity="0.6" />
            <circle cx="28" cy="28" r="4" opacity="0.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ── Kalash ───────────────────────────────────────────────────────────────
   The auspicious pot: wide belly, narrow neck, mango leaves fanning out, a
   coconut on top. Drawn once, used at the head of ceremonies — and here at the
   head of the footer. */
export function KalashMotif({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 64 96"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {/* Coconut. */}
      <circle cx="32" cy="18" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M32 10v5M27 13l2.5 2.5M37 13l-2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      {/* Mango leaves. */}
      <path
        d="M32 30c-8-4-16-6-22-4 4 6 10 10 18 9M32 30c8-4 16-6 22-4-4 6-10 10-18 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Neck. */}
      <path d="M24 38h16M25 44h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Belly. */}
      <path
        d="M25 44c-9 3-13 11-13 20s7 20 20 20 20-9 20-20-4-17-13-20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* The thread tied around it, and the belly band. */}
      <path d="M25 50c4 2 10 2 14 0" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <path d="M14 68h36" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      {/* Two eyes on the shoulder. */}
      <circle cx="26" cy="62" r="1.6" fill="currentColor" opacity="0.7" />
      <circle cx="38" cy="62" r="1.6" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ── Temple arch ──────────────────────────────────────────────────────────
   A cusped multifoil arch, the silhouette every Indian miniature, temple and
   palace doorway shares. Used to frame a single image or a pull quote. */
export function TempleArch({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 100 140"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <path
        d="M4 140V52c0-6 3-9 7-12C16 36 22 33 24 26c2-8 8-14 16-18
           c4-2 7-4 10-8 3 4 6 6 10 8 8 4 14 10 16 18 2 7 8 10 13 14
           4 3 7 6 7 12v88"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 140V54c0-4 2-6 5-8 5-4 10-7 12-13 2-6 6-10 12-13
           c3-2 5-3 7-6 2 3 4 4 7 6 6 3 10 7 12 13 2 6 7 9 12 13
           3 2 5 4 5 8v86"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
    </svg>
  );
}

/* ── Lotus cluster ────────────────────────────────────────────────────────
   A full lotus in bloom, petals in three registers — the form that sits at the
   centre of every Indian Buddhist and Hindu decoration. Sharper than the
   generic "botanical" mark it replaces. */
export function LotusBloom({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {/* Outer petals. */}
      <path
        d="M60 68c-14 0-26-6-34-16 8-6 18-8 26-4M60 68c14 0 26-6 34-16-8-6-18-8-26-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M60 68C48 68 38 62 30 52c10-2 20 0 26 6M60 68c12 0 22-6 30-16-10-2-20 0-26 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Inner petals. */}
      <path
        d="M60 66C50 60 44 50 44 40c8 4 14 12 16 20M60 66c10-6 16-16 16-26-8 4-14 12-16 20"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* The crown petal. */}
      <path d="M60 64c-6-8-6-18 0-26 6 8 6 18 0 26z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      {/* Water line. */}
      <path d="M18 74c10-4 22-4 32 0s22 4 32 0 20-4 26 0" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/* ── Diamond lattice band ─────────────────────────────────────────────────
   The repeating chevron-and-diamond border that edges almost every Indian
   textile and manuscript page. Useful as a divider where a kolam would be too
   ornate. */
export function DiamondBand({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 12"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <path d="M0 6h120" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {[10, 30, 50, 70, 90, 110].map((x) => (
        <g key={x}>
          <path d={`M${x} 1l5 5-5 5-5-5z`} stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx={x} cy={6} r="0.9" fill="currentColor" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

/* ── Madhubani fish ──────────────────────────────────────────────────────
   Mithila painting puts a pair of fish at every threshold and wedding wall —
   the shape that means fertility, abundance, and "may this never run dry".
   Drawn with the double outline Mithila painters use in place of shading. */
export function MadhubaniFish({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <path
        d="M82 30c0 11-13 20-30 20S22 41 22 30 35 10 52 10s30 9 30 20z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M82 30c0 6-10 11-24 11s-24-5-24-11 10-11 24-11 24 5 24 11z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
      {/* Tail. */}
      <path d="M82 30l18-13v26z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      {/* Double eye — the Mithila convention. */}
      <circle cx="41" cy="25" r="2.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="41" cy="25" r="0.9" fill="currentColor" />
      {/* Gills and scale strokes. */}
      <path d="M62 17v26M54 16v28M46 18v24" stroke="currentColor" strokeWidth="0.9" opacity="0.45" />
      <path d="M70 20c4 3 4 17 0 20" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/* ── Peacock feather eye ─────────────────────────────────────────────────
   The single most recognisable motif in Indian decorative art — used on
   temple carvings, Phulkari textiles, and manuscript borders. Here it is one
   feather's eye, the part people actually recognise. */
export function PeacockEye({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 80 120"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {/* The quill. */}
      <path d="M40 112c0-22-9-36-9-50" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      {/* Outer plume. */}
      <path
        d="M40 62c-18 0-30-14-30-28S22 4 40 4s30 16 30 30-12 28-30 28z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {/* The eye itself. */}
      <ellipse cx="40" cy="32" rx="13" ry="19" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="40" cy="34" rx="6.5" ry="11" fill="currentColor" opacity="0.22" />
      <ellipse cx="40" cy="34" rx="3" ry="6" fill="currentColor" opacity="0.55" />
      {/* Comb strokes at the crown. */}
      <path d="M40 12v6M28 16l4 5M52 16l-4 5M20 26l6 3M60 26l-6 3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M22 98c6 4 12 6 18 6s12-2 18-6" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

/* ── Lotus rosette with eight petals ─────────────────────────────────────
   A padma from which every mandala is built. Eight-fold symmetry, one petal
   register at a time, exactly as it is drawn inset into temple ceilings. */
export function LotusRosette({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {[0, 45, 90, 135].map((rot) => (
        <g key={rot} transform={`rotate(${rot} 60 60)`}>
          <path d="M60 60c-4-13-4-26 0-36 4 10 4 23 0 36z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M60 60c-4-13-4-26 0-36-4 10-4 23 0 36z" stroke="currentColor" strokeWidth="1.2" />
        </g>
      ))}
      {[0, 45, 90, 135].map((rot) => (
        <g key={`o${rot}`} transform={`rotate(${rot + 22.5} 60 60)`}>
          <path d="M60 58c-3-9-8-16-14-20 2 8 8 16 14 20zM60 58c3-9 8-16 14-20-2 8-8 16-14 20z" stroke="currentColor" strokeWidth="1" opacity="0.65" />
        </g>
      ))}
      <circle cx="60" cy="60" r="7" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="2.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/* ── Hamsa (sacred swan) in geometric line ───────────────────────────────
   The hamsa carries the breath of life and appears at the head of every
   manuscript page. Drawn from arcs and a single curve, the way a scroll
   painter would set it down in one movement. */
export function HamsaMotif({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {/* Body. */}
      <path
        d="M28 76c-8-2-13-9-12-17 1-9 9-15 19-15 8 0 14 4 18 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M53 54c11-9 26-12 40-9 12 3 20 12 20 22 0 5-3 9-8 10-14 3-38 2-52-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* The neck, the S-curve that makes a swan a swan. */}
      <path
        d="M28 76c-6-14 0-26 10-34 8-7 14-14 16-24"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Head and beak. */}
      <circle cx="56" cy="16" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M61 16h12l-6 3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="55" cy="15" r="1.1" fill="currentColor" />
      {/* Feather hatch. */}
      <path
        d="M62 58c6 2 12 3 18 3M60 64c9 3 19 4 28 4M62 70c8 2 18 3 27 2"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.45"
      />
      {/* Water. */}
      <path
        d="M12 86c10-4 20-4 30 0s20 4 30 0 20-4 30 0 16 3 22 1"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}

/* ── Running vine (bel-buti) ─────────────────────────────────────────────
   The scrolling vine border that frames every Mughal manuscript and every
   block-printed sari. Leaves alternate off a single curving stem. */
export function BelButi({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 24"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <path
        d="M0 12c16 0 16-8 32-8s16 8 32 8 16-8 32-8 16 8 32 8 16-8 32-8 16 8 40 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.7"
      />
      {[16, 48, 80, 112, 144, 176].map((x, i) => (
        <g key={x}>
          {/* Leaf, alternating above and below the stem. */}
          <path
            d={
              i % 2 === 0
                ? `M${x} 6c-4-5-3-9 2-10 3 3 3 7-2 10z`
                : `M${x} 18c-4 5-3 9 2 10 3-3 3-7-2-10z`
            }
            stroke="currentColor"
            strokeWidth="1"
            fill="currentColor"
            fillOpacity="0.12"
          />
          {/* Bud at the node. */}
          <circle cx={x} cy="12" r="1.4" fill="currentColor" opacity="0.65" />
        </g>
      ))}
    </svg>
  );
}

/* ── Diya (oil lamp) ─────────────────────────────────────────────────────
   The single flame at the centre of every Indian threshold and every
   festival. Drawn small, because it is always small. */
export function DiyaMotif({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      {/* Flame, with the inner tongue. */}
      <path d="M30 6c5 7 7 12 7 16 0 5-3 8-7 8s-7-3-7-8c0-4 2-9 7-16z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M30 14c2 4 3 6 3 8 0 2-1 4-3 4s-3-2-3-4c0-2 1-4 3-8z" fill="currentColor" opacity="0.35" />
      {/* The bowl, a shallow arc with a lip. */}
      <path d="M10 36h40c-3 9-11 15-20 15S13 45 10 36z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M14 39h32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Glow rays. */}
      <path d="M30 32v-2M20 33l-2 2M40 33l2 2M16 28l-2-1M44 28l2-1" stroke="currentColor" strokeWidth="1" opacity="0.45" strokeLinecap="round" />
    </svg>
  );
}

/* ── A strip of Mithila double-line border ───────────────────────────────
   Mithila (Madhubani) painting borders every field with parallel lines and a
   repeating glyph between them. This is that strip. */
export function MithilaBorder({ className = "", style }: MotifProps) {
  return (
    <svg
      viewBox="0 0 240 20"
      fill="none"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ ...decorative, ...style }}
    >
      <path d="M0 3h240M0 17h240" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      {Array.from({ length: 12 }, (_, i) => 10 + i * 20).map((x) => (
        <g key={x}>
          <path d={`M${x} 10c-3-4-3-5 0-6 3 1 3 2 0 6z`} stroke="currentColor" strokeWidth="0.9" />
          <path d={`M${x} 10c3 4 3 5 0 6-3-1-3-2 0-6z`} stroke="currentColor" strokeWidth="0.9" />
          <path d={`M${x - 7} 10h-3M${x + 7} 10h3`} stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
        </g>
      ))}
    </svg>
  );
}
