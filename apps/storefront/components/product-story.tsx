import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * The lower half of a product page: what the work is, and where to go next.
 *
 * Two rules learned from the previous version:
 *
 *  1. **Do not repeat the header.** The page already states the title, the art
 *     form, the maker and the availability above the fold. This section used to
 *     repeat all four in a definition list directly beneath them, so a buyer read
 *     the same facts twice and the page felt padded. What is left here is the
 *     *story*: why the tradition matters, what the symbols carry, how the piece
 *     was made — the part that cannot fit in a spec table.
 *
 *  2. **No card, no box.** The composition is an editorial two-column spread on
 *     the page ground. Whitespace and a hairline do the organising; a bordered
 *     panel here would read as a second product.
 */
export async function ProductStory({
  title,
  artist,
  collection,
}: {
  title: string;
  artist?: string;
  collection?: string;
}) {
  const t = await getTranslations("productDetail");

  return (
    <>
      {/* ── The story ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="artwork-story"
        className="mt-20 border-t border-sand-border/60 pt-14"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-terracotta">
              {t("workEyebrow")}
            </p>
            <h2
              id="artwork-story"
              className="mt-3 font-serif text-2xl font-semibold leading-snug tracking-tight text-deep-ink sm:text-3xl"
            >
              {t("workTitle")}
            </h2>
          </div>

          <div className="max-w-2xl space-y-5">
            <p className="font-serif text-lg italic leading-relaxed text-deep-ink/85 sm:text-xl">
              {collection
                ? t("collectionBody", { collection: collection.toLowerCase() })
                : t("genericBody")}
            </p>

            <p className="font-sans text-[15px] leading-[1.75] text-muted-ink">
              {artist ? `${t("madeBy", { artist })} ` : ""}
              {t("symbolsNote")}
            </p>

            <p className="font-sans text-[15px] leading-[1.75] text-muted-ink">
              {collection
                ? `“${title}” belongs to the ${collection.toLowerCase()} tradition, still practised today by families who have made this work for generations. ${t(
                    "values.method"
                  )}, the piece carries the small irregularities that mark a hand rather than a press.`
                : `“${title}” is ${t("values.method").toLowerCase()}. It carries the small irregularities that mark a hand rather than a press.`}
            </p>

            <Link
              href="/authenticity"
              className="inline-flex items-center gap-2 font-sans text-sm font-medium text-terracotta underline-offset-4 hover:underline"
            >
              {t("authenticityNote")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Continue the journey ──────────────────────────────────────── */}
      <nav
        aria-label={t("continueLabel")}
        className="mt-16 grid border-t border-sand-border/60 sm:grid-cols-3"
      >
        {[
          {
            href: "/art-forms",
            eyebrow: t("doors.tradition"),
            title: collection
              ? t("moreAbout", { collection: collection.toLowerCase() })
              : t("readTraditions"),
          },
          {
            href: "/learn",
            eyebrow: t("doors.reference"),
            title: t("doors.referenceTitle"),
          },
          {
            href: "/custom-art",
            eyebrow: t("doors.madeForYou"),
            title: t("doors.madeForYouTitle"),
          },
        ].map((door, index) => (
          <Link
            key={door.eyebrow}
            href={door.href}
            className={`group flex flex-col justify-between gap-6 py-7 transition-colors hover:bg-surface/60 sm:px-6 ${
              index > 0 ? "border-t border-sand-border/60 sm:border-l sm:border-t-0" : ""
            } ${index === 0 ? "sm:pl-0" : ""}`}
          >
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-ink/70">
                {door.eyebrow}
              </p>
              <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                {door.title}
              </h3>
            </div>
            <span
              aria-hidden="true"
              className="text-lg text-terracotta transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
