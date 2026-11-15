import { Link } from "@/i18n/routing";
import Image from "next/image";
import { KalamBorder, MandalaField } from "./ornaments";
import { JaaliField, PaperGrain, ButiField } from "./grounds";
import { LotusRosette, PaisleyBand } from "./indian-motifs";

/**
 * The header every interior page shares.
 *
 * Artist sites open with a quiet, image-led masthead rather than a shop banner:
 * a breadcrumb, an eyebrow, a large serif title, one line of intent, and the
 * artwork itself bleeding behind. Having a single component means Shop, Art
 * Forms, Custom Art, About and the Journal all open the same way instead of
 * each inventing its own heading block.
 *
 * THE PLAIN CASE WAS THE BUG.
 * Pages without a hero image — the Journal, About, Custom Art, the policies —
 * fell through to a bare parchment block with no ornament at all, which is why
 * those pages read as unfinished next to the homepage. The no-image masthead
 * now gets its own treatment: a jaali screen behind the title, parchment grain,
 * a paisley frieze at the foot and a rosette at the corner. Same quiet
 * masthead, but it is standing in a carved room instead of a white box.
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
      {hasImage ? (
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
      ) : (
        <>
          {/* The room the title stands in, when there is no photograph to
              stand in front of. */}
          <JaaliField style={{ opacity: 0.9 }} />
          <ButiField style={{ opacity: 0.7 }} />
          <PaperGrain />
          {/* A rosette tucked into the top-right, half off the page, the way a
              carved boss sits at the corner of a ceiling. */}
          <LotusRosette className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 text-terracotta/[0.10] sm:h-64 sm:w-64" />
          {/* The foot of the masthead is now the real painted frieze rather
              than a drawn paisley band. At 40px a vector motif reads as a
              rule; the photograph of gold-on-burgundy ornament reads as a
              carved ledge, which is what this line is meant to be. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-9 overflow-hidden opacity-[0.22] mix-blend-multiply"
          >
            <Image
              src="/images/ornaments/gold-vine-band.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
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
