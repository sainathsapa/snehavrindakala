/**
 * The factual specification panel on a product page.
 *
 * Art buyers decide with logistics as much as emotion: size, medium, framing,
 * whether it ships framed, how long it takes. Those facts used to live only in
 * the operator's head; here they are surfaced as a quiet, scannable table that
 * sits *under* the artwork rather than competing with it.
 *
 * Only rows with a real value render. Nothing is invented to fill the grid.
 */
import type { ArtworkSpecs } from "@/lib/catalogue";

const ROWS: { key: keyof ArtworkSpecs; label: string }[] = [
  { key: "dimensions", label: "Dimensions" },
  { key: "medium", label: "Medium & materials" },
  { key: "framing", label: "Framing" },
  { key: "year", label: "Year" },
  { key: "edition", label: "Edition" },
  { key: "dispatch", label: "Dispatch" },
  { key: "care", label: "Care" },
];

export function ArtworkSpecsPanel({
  specs,
}: {
  specs: ArtworkSpecs;
}) {
  const rows = ROWS.filter((row) => specs[row.key]);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-sm border border-sand-border/80 bg-surface/60">
      <dl className="divide-y divide-sand-border/60">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[130px_1fr] gap-4 px-4 py-2.5 sm:grid-cols-[160px_1fr]"
          >
            <dt className="font-sans text-[11px] uppercase tracking-[0.14em] text-muted-ink">
              {row.label}
            </dt>
            <dd className="font-sans text-sm text-deep-ink">
              {specs[row.key]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
