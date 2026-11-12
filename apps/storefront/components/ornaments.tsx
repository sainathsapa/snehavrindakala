/**
 * Shared decorative motifs from the brand references.
 *
 * Both reference designs repeat the same language at section boundaries: a
 * small orange botanical sprig beside a fine vertical rule, an uppercase
 * eyebrow label, and a short orange rule under it. Centralising them keeps
 * every section on the site opening identically.
 */

/**
 * A leaf sprig with a hanging vertical rule — the mark that opens each
 * editorial section in the references.
 */
export function BotanicalRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`} aria-hidden="true">
      <svg width="26" height="46" viewBox="0 0 26 46" fill="none">
        <path
          d="M13 44V16"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M13 18c-5 0-9-3-9-7 5 0 9 3 9 7z"
          fill="currentColor"
          opacity="0.85"
        />
        <path
          d="M13 12c-4 0-7-3-7-6 4 0 7 2 7 6z"
          fill="currentColor"
        />
        <path
          d="M13 24c5 0 9-3 9-7-5 0-9 3-9 7z"
          fill="currentColor"
          opacity="0.7"
        />
        <circle cx="13" cy="6" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * Eyebrow + heading + optional rule, as used above every section title in the
 * references (e.g. "EXPLORE — Indian Art Forms").
 */
export function SectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "dark",
  className = "",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}) {
  const isLight = tone === "light";

  return (
    <div
      className={`${align === "center" ? "text-center" : ""} ${className}`}
    >
      <p
        className={`font-sans text-[11px] font-semibold uppercase tracking-[0.22em] ${
          isLight ? "text-haldi" : "text-terracotta"
        }`}
      >
        {eyebrow}
      </p>
      <span
        className={`mt-2 block h-px w-10 ${
          align === "center" ? "mx-auto" : ""
        } ${isLight ? "bg-haldi/70" : "bg-terracotta/60"}`}
        aria-hidden="true"
      />
      <h2
        className={`mt-4 font-serif text-display-md font-semibold leading-[1.15] ${
          isLight ? "text-rang-paper" : "text-deep-ink"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-3 max-w-md font-sans text-small leading-relaxed ${
            align === "center" ? "mx-auto" : ""
          } ${isLight ? "text-rang-paper/75" : "text-muted-ink"}`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/** Text link with a trailing arrow, the default secondary action. */
export function ArrowLink({
  href,
  children,
  tone = "dark",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2 font-sans text-sm font-medium transition-colors ${
        tone === "light"
          ? "text-rang-paper hover:text-haldi"
          : "text-kumkum hover:text-terracotta"
      } ${className}`}
    >
      {children}
      <span
        className="transition-transform duration-200 group-hover:translate-x-1"
        aria-hidden="true"
      >
        →
      </span>
    </a>
  );
}
