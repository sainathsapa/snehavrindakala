import Link from "next/link";

/**
 * The lower half of a product page: what the work is, what it is made of, and
 * where to go next.
 *
 * Both product branches need this. The Medusa branch and the seed-catalogue
 * branch have different data shapes and different purchase affordances, but a
 * visitor does not know or care which one they landed on — a page carrying only
 * a title, a price and a description reads as a stock listing either way. Rather
 * than duplicate the composition in two files, every line here is derived from
 * whatever the record actually says, so nothing is invented to fill a slot.
 */
export function ProductStory({
  title,
  artist,
  collection,
  stockType,
}: {
  title: string;
  artist?: string;
  collection?: string;
  stockType?: string;
}) {
  const availability =
    stockType === "ready_to_ship"
      ? "Ready to ship"
      : stockType === "custom_only"
        ? "Commission only"
        : stockType === "made_to_order"
          ? "Made to order"
          : "Enquire";

  return (
    <>
      {/* ── The story and the details ─────────────────────────────────── */}
      <div className="mt-16 grid gap-12 border-t border-sand-border/60 pt-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
            The work
          </p>
          <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug text-deep-ink sm:text-3xl">
            Made by hand, in a tradition that predates the market for it
          </h2>
          <p className="mt-4 font-serif text-base italic leading-relaxed text-muted-ink">
            {collection
              ? `This piece belongs to the ${collection.toLowerCase()} tradition — a language of line, colour and symbol taught from one pair of hands to the next.`
              : "Every work here is made by hand, by a named maker, in a tradition that was taught rather than invented."}
          </p>
          <p className="mt-4 font-sans text-sm leading-relaxed text-muted-ink">
            {artist ? `Made by ${artist}. ` : ""}The border work and the symbols
            in a piece like this are rarely decorative — they carry meaning the
            maker chooses, and can usually explain.
          </p>
        </div>

        <dl className="divide-y divide-sand-border/60 border-y border-sand-border/60">
          {[
            ["Work", title],
            ["Art form", collection || "Traditional Indian art"],
            ...(artist ? [["Maker", artist]] : []),
            ["Method", "Made by hand, one piece at a time"],
            ["Origin", "India"],
            ["Availability", availability],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-6 py-3.5"
            >
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-ink/70">
                {label}
              </dt>
              <dd className="text-right font-serif text-[15px] text-deep-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Continue the journey ────────────────────────────────────────── */}
      <div className="mt-14 grid border-t border-sand-border/60 sm:grid-cols-3">
        {[
          {
            href: "/art-forms",
            eyebrow: "The tradition",
            title: collection
              ? `More about ${collection.toLowerCase()}`
              : "Read the traditions",
          },
          {
            href: "/learn",
            eyebrow: "The reference",
            title: "What the symbols mean",
          },
          {
            href: "/custom-art",
            eyebrow: "Made for you",
            title: "Commission something like it",
          },
        ].map((door, i) => (
          <Link
            key={door.eyebrow}
            href={door.href}
            className={`group flex flex-col justify-between gap-6 px-1 py-7 transition-colors hover:bg-surface/60 sm:px-6 ${
              i > 0
                ? "border-t border-sand-border/60 sm:border-l sm:border-t-0"
                : ""
            }`}
          >
            <div>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-ink/70">
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
      </div>
    </>
  );
}
