import Link from "next/link";
import { KalamBorder, MandalaField } from "./ornaments";

/**
 * The header every interior page shares.
 *
 * Artist sites open with a quiet, image-led masthead rather than a shop banner:
 * a breadcrumb, an eyebrow, a large serif title, one line of intent, and the
 * artwork itself bleeding behind. Having a single component means Shop, Art
 * Forms, Custom Art, About and the Journal all open the same way instead of
 * each inventing its own heading block.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  breadcrumb,
  image,
  align = "left",
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  breadcrumb?: { label: string; href?: string }[];
  /** Artwork behind the title. Omit for a plain parchment masthead. */
  image?: string;
  align?: "left" | "center";
  children?: React.ReactNode;
}) {
  const hasImage = Boolean(image);

  return (
    <header className="relative overflow-hidden">
      {hasImage && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2A120C]/95 via-[#2A120C]/78 to-[#2A120C]/35" />
          <MandalaField className="pointer-events-none absolute -right-14 top-1/2 hidden h-72 w-72 -translate-y-1/2 text-haldi/20 md:block" />
          <KalamBorder className="absolute inset-x-0 bottom-0 text-haldi/35" />
        </>
      )}

      <div
        className={`relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 ${
          hasImage ? "py-14 lg:py-20" : "pb-10 pt-8"
        }`}
      >
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className={`mb-6 flex flex-wrap items-center gap-2 font-sans text-xs ${
              hasImage ? "text-rang-paper/70" : "text-muted-ink"
            }`}
          >
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className={
                      hasImage
                        ? "transition-colors hover:text-haldi"
                        : "transition-colors hover:text-kumkum"
                    }
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={hasImage ? "text-rang-paper" : "text-deep-ink"}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div
          className={
            align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"
          }
        >
          {eyebrow && (
            <p
              className={`font-sans text-[11px] font-semibold uppercase tracking-[0.26em] ${
                hasImage ? "text-haldi" : "text-terracotta"
              }`}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={`mt-3 font-serif font-semibold leading-[1.08] tracking-tight ${
              hasImage
                ? "text-[38px] text-rang-paper sm:text-[52px] lg:text-[60px]"
                : "text-[36px] text-deep-ink sm:text-[46px]"
            }`}
          >
            {title}
          </h1>
          {intro && (
            <p
              className={`mt-4 font-sans text-small leading-relaxed sm:text-base ${
                hasImage ? "text-rang-paper/80" : "text-muted-ink"
              }`}
            >
              {intro}
            </p>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
