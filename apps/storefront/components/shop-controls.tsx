"use client";

/**
 * Shop controls: sort + filters, rendered as a quiet caption line on desktop
 * and a slide-up drawer on a phone.
 *
 * All state lives in the URL, not in React — that is what makes a filtered view
 * shareable, bookmarkable and correct on back/forward, and it lets the server
 * do the filtering. The component only reads the current params and navigates.
 */

import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface ShopControlsProps {
  total: number;
  shown: number;
  forms: FilterOption[];
  mediums: string[];
  /** Base path without query, so the drawer can rebuild links cleanly. */
  basePath: string;
}

const SORT_VALUES = ["featured", "newest", "price-asc", "price-desc"] as const;

const SORT_KEYS: Record<string, string> = {
  featured: "sortFeatured",
  newest: "sortNewest",
  "price-asc": "sortPriceAsc",
  "price-desc": "sortPriceDesc",
};

export function ShopControls({
  total,
  shown,
  forms,
  mediums,
}: ShopControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("shopControls");
  const [pending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState(false);

  const current = (key: string) => params.get(key) ?? "";

  const push = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    // Any filter change resets pagination-style state we may add later; harmless
    // if absent.
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const setParam = (key: string, value: string) => {
    push((p) => {
      if (!value) p.delete(key);
      else p.set(key, value);
    });
  };

  const activeCount = ["form", "medium", "availability", "min", "max", "query"].filter(
    (k) => params.get(k)
  ).length;

  const clearAll = () => {
    push((p) => {
      ["form", "medium", "availability", "min", "max", "query"].forEach((k) =>
        p.delete(k)
      );
    });
    setDrawer(false);
  };

  const sort = current("sort") || "featured";

  const filterBody = (
    <div className="space-y-6">
      <FilterGroup label={t("searchWithin")}>
        <input
          type="search"
          defaultValue={current("query")}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchWithin")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParam("query", (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => setParam("query", e.target.value)}
          className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-1 focus:ring-sindoor"
        />
      </FilterGroup>

      <FilterGroup label={t("tradition")}>
        <div className="flex flex-wrap gap-2">
          {forms.map((f) => {
            const active = current("form") === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setParam("form", active ? "" : f.value)}
                className={`rounded-full border px-3 py-1.5 font-sans text-xs transition-colors ${
                  active
                    ? "border-sindoor bg-sindoor text-rang-paper"
                    : "border-sand-border text-deep-ink/80 hover:border-sindoor/60"
                }`}
                aria-pressed={active}
              >
                {f.label}
                {f.count != null && (
                  <span className="ml-1.5 opacity-60">{f.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {mediums.length > 0 && (
        <FilterGroup label={t("medium")}>
          <div className="flex flex-wrap gap-2">
            {mediums.map((m) => {
              const active = current("medium") === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setParam("medium", active ? "" : m)}
                  className={`rounded-full border px-3 py-1.5 font-sans text-xs transition-colors ${
                    active
                      ? "border-sindoor bg-sindoor text-rang-paper"
                      : "border-sand-border text-deep-ink/80 hover:border-sindoor/60"
                  }`}
                  aria-pressed={active}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup label={t("availability")}>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "ready", label: t("readyToShip") },
            { value: "made-to-order", label: t("madeToOrder") },
          ].map((a) => {
            const active = current("availability") === a.value;
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => setParam("availability", active ? "" : a.value)}
                className={`rounded-full border px-3 py-1.5 font-sans text-xs transition-colors ${
                  active
                    ? "border-sindoor bg-sindoor text-rang-paper"
                    : "border-sand-border text-deep-ink/80 hover:border-sindoor/60"
                }`}
                aria-pressed={active}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label={t("price")}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("minPlaceholder")}
            defaultValue={current("min")}
            onBlur={(e) => setParam("min", e.target.value)}
            aria-label={t("minAria")}
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-1 focus:ring-sindoor"
          />
          <span className="text-muted-ink">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("maxPlaceholder")}
            defaultValue={current("max")}
            onBlur={(e) => setParam("max", e.target.value)}
            aria-label={t("maxAria")}
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-1 focus:ring-sindoor"
          />
        </div>
      </FilterGroup>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="font-sans text-xs font-medium text-terracotta hover:text-kumkum"
        >
          {t("clearAll")}
        </button>
      )}
    </div>
  );

  return (
    <div>
      {/* Caption-style control line (desktop) */}
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-sand-border/60 pb-4">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
          {shown} {shown === 1 ? t("worksOne") : t("worksMany")}
          {shown !== total ? ` ${t("ofTotal", { total })}` : ""}
        </span>

        <button
          type="button"
          onClick={() => setDrawer((d) => !d)}
          className="flex items-center gap-1.5 font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum lg:hidden"
          aria-expanded={drawer}
        >
          {t("filters")}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sindoor px-1 text-[10px] font-sans not-italic text-rang-paper">
              {activeCount}
            </span>
          )}
        </button>

        {/* Desktop inline filters toggle */}
        <button
          type="button"
          onClick={() => setDrawer((d) => !d)}
          className="hidden items-center gap-1.5 font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum lg:flex"
          aria-expanded={drawer}
          aria-controls="shop-filters"
        >
          {drawer ? t("hideFilters") : t("filters")}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sindoor px-1 text-[10px] font-sans not-italic text-rang-paper">
              {activeCount}
            </span>
          )}
        </button>

        <label className="ml-auto flex items-center gap-2 font-sans text-xs text-muted-ink">
          {t("sortLabel")}
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="rounded-md border border-sand-border bg-surface px-2 py-1.5 font-sans text-xs text-deep-ink focus:outline-none focus:ring-1 focus:ring-sindoor"
          >
            {SORT_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(SORT_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
        {pending && (
          <span className="font-sans text-xs text-muted-ink" role="status">
            {t("updating")}
          </span>
        )}
      </div>

      {/* Active chips */}
      {activeCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {current("query") && (
            <Chip label={`“${current("query")}”`} onClear={() => setParam("query", "")} />
          )}
          {current("form") && (
            <Chip label={forms.find((f) => f.value === current("form"))?.label || current("form")} onClear={() => setParam("form", "")} />
          )}
          {current("medium") && (
            <Chip label={current("medium")} onClear={() => setParam("medium", "")} />
          )}
          {current("availability") && (
            <Chip
              label={current("availability") === "ready" ? t("readyToShip") : t("madeToOrder")}
              onClear={() => setParam("availability", "")}
            />
          )}
          {(current("min") || current("max")) && (
            <Chip
              label={`₹${current("min") || "0"}–${current("max") || "∞"}`}
              onClear={() => push((p) => { p.delete("min"); p.delete("max"); })}
            />
          )}
        </div>
      )}

      {drawer && (
        <div
          id="shop-filters"
          className="mb-10 rounded-sm border border-sand-border/70 bg-surface/70 p-5"
        >
          {filterBody}
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-ink">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-border bg-surface px-3 py-1 font-sans text-xs text-deep-ink">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="text-muted-ink hover:text-kumkum"
      >
        ×
      </button>
    </span>
  );
}
