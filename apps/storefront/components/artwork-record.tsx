/**
 * "The record" — a work's place in the world, as a catalogue would state it.
 *
 * The spec panel above answers "how big, made of what". This answers the
 * question art buyers actually ask next: *where does this come from, and who
 * made it.* It is the difference between a listing and a catalogue entry.
 *
 * Three facts only, each optional and each derived from data that already
 * exists:
 *   - the tradition it belongs to, with its description from site content
 *   - the region that tradition names, when the row carries one
 *   - the maker, linked to their entry in the makers directory
 *
 * Nothing here is inferred. A work with no category shows no tradition row; a
 * work with no maker shows no maker row. The block renders nothing at all if it
 * would be empty, rather than printing headings over blanks.
 */
import { Link } from "@/i18n/routing";
import { slugify } from "@/lib/slugs";

export function ArtworkRecord({
  tradition,
  traditionDescription,
  traditionHref,
  origin,
  maker,
  makerHref,
  title = "The record",
  labels,
}: {
  /** Human name of the tradition, e.g. "Madhubani". */
  tradition?: string;
  /** One line on the tradition, from site content. Omitted when absent. */
  traditionDescription?: string;
  /** Link into the tradition page, when the category has a handle. */
  traditionHref?: string;
  /** Region the tradition is practised in. Only when the record states it. */
  origin?: string;
  /** The hand that made the work. */
  maker?: string;
  /** Link to the maker's entry in the directory. */
  makerHref?: string;
  title?: string;
  /** Translated labels, so the surrounding copy is not hardcoded English. */
  labels?: { tradition?: string; region?: string; maker?: string };
}) {
  const rows: {
    key: string;
    label: string;
    value: string;
    href?: string;
    note?: string;
  }[] = [];

  if (tradition) {
    rows.push({
      key: "tradition",
      label: labels?.tradition ?? "Tradition",
      value: tradition,
      href: traditionHref,
      note: traditionDescription,
    });
  }

  if (origin) {
    rows.push({
      key: "region",
      label: labels?.region ?? "Region",
      value: origin,
    });
  }

  if (maker) {
    rows.push({
      key: "maker",
      label: labels?.maker ?? "Maker",
      value: maker,
      href: makerHref,
    });
  }

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="artwork-record">
      <h2
        id="artwork-record"
        className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta"
      >
        {title}
      </h2>

      <dl className="mt-4 divide-y divide-sand-border/50 border-y border-sand-border/60">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[100px_1fr] items-baseline gap-4 py-2.5 sm:grid-cols-[150px_1fr]"
          >
            <dt className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted-ink">
              {row.label}
            </dt>
            <dd className="font-sans text-[13.5px] leading-relaxed text-deep-ink">
              {row.href ? (
                <Link
                  href={row.href}
                  className="font-serif text-[15px] italic text-deep-ink underline decoration-sand-border decoration-1 underline-offset-4 transition-colors hover:text-kumkum hover:decoration-kumkum"
                >
                  {row.value}
                </Link>
              ) : (
                row.value
              )}
              {row.note && (
                <span className="mt-1 block font-sans text-[12.5px] leading-relaxed text-muted-ink">
                  {row.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
