/**
 * Drawn ornaments for the plates.
 *
 * These are SVG rather than images on purpose: they scale to any size, weigh
 * nothing, print crisply, and can take the brand colours as currentColor. A
 * photograph of a paisley would also date the page; a drawn one does not.
 */

/** The pulli dot grid — the constraint a kolam is drawn around. */
export function PulliGrid({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="pulli" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1.1" fill="currentColor" opacity="0.55" />
        </pattern>
      </defs>
      <rect width="120" height="120" fill="url(#pulli)" />
    </svg>
  );
}

/** A paisley (ambi) rule, used to separate sections the way a book does. */
export function AmbiRule({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 240 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M0 12h86" opacity="0.4" />
      <path d="M154 12h86" opacity="0.4" />
      {/* the ambi: a drop whose tip curls back on itself */}
      <path d="M120 4c-7 0-12 5-12 11s5 8 9 8 8-3 8-7-3-6-6-6-5 2-5 4 1 3 3 3" />
      <circle cx="112" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="128" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The plate seal: a numeral ringed like a book's plate mark. */
export function PlateSeal({
  numeral,
  label,
  className = "",
}: {
  numeral: string;
  label: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="48" cy="48" r="45" strokeWidth="0.75" opacity="0.5" />
      <circle cx="48" cy="48" r="38" strokeWidth="0.5" opacity="0.3" />
      {/* four tick marks, at the quarters */}
      {[0, 90, 180, 270].map((angle) => (
        <line
          key={angle}
          x1="48"
          y1="6"
          x2="48"
          y2="11"
          strokeWidth="1"
          transform={`rotate(${angle} 48 48)`}
          opacity="0.6"
        />
      ))}
      <text
        x="48"
        y="44"
        textAnchor="middle"
        className="font-serif"
        fill="currentColor"
        stroke="none"
        style={{ fontSize: 22, letterSpacing: "0.5px" }}
      >
        {numeral}
      </text>
      <text
        x="48"
        y="62"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        style={{ fontSize: 6.5, letterSpacing: "1.8px", textTransform: "uppercase" }}
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

/** A torana: two supports, a spanning member, hanging leaves. */
export function ToranaMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 64 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M8 36V12h48v24" opacity="0.7" />
      <path d="M3 12h58" opacity="0.9" />
      <path d="M3 8c8 4 16 4 24 0s16-4 24 0 8 4 10 4" opacity="0.4" />
      {[16, 24, 32, 40, 48].map((x, index) => (
        <path key={x} d={`M${x} 12v${7 + (index % 2 ? 4 : 7)}`} opacity="0.55" />
      ))}
    </svg>
  );
}

/** The mandala-ish watermark behind a plate title. */
export function ChakraWatermark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
    >
      <circle cx="100" cy="100" r="94" opacity="0.5" />
      <circle cx="100" cy="100" r="72" opacity="0.35" />
      <circle cx="100" cy="100" r="34" opacity="0.5" />
      {Array.from({ length: 16 }).map((_, index) => {
        const angle = (index * Math.PI * 2) / 16;
        const r1 = 34;
        const r2 = 94;
        return (
          <line
            key={index}
            x1={100 + Math.cos(angle) * r1}
            y1={100 + Math.sin(angle) * r1}
            x2={100 + Math.cos(angle) * r2}
            y2={100 + Math.sin(angle) * r2}
            opacity="0.22"
          />
        );
      })}
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index * Math.PI * 2) / 8;
        return (
          <circle
            key={index}
            cx={100 + Math.cos(angle) * 72}
            cy={100 + Math.sin(angle) * 72}
            r="5"
            opacity="0.4"
          />
        );
      })}
    </svg>
  );
}
