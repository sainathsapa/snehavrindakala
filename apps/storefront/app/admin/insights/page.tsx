"use client";

/**
 * What the shop learned about its buyers.
 *
 * Three questions the studio could not answer before this page: what people
 * searched for, how many baskets turned into orders, and what actually came in.
 *
 * The search column is the one to read first. Every query is somebody saying what
 * they hoped to buy, and a query that found nothing is the catalogue's to-do list —
 * it names a work that would have sold.
 */

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@snehavrinda-kala/ui";

interface SearchStat {
  query: string;
  searches: number;
  results: number;
}

interface Payload {
  days: number;
  searches: { total: number; answered: number; top: SearchStat[]; unanswered: SearchStat[] };
  basket: { created: number; converted: number; abandoned: number; conversion: number | null } | null;
  money: { captured: number; refunded: number; orders: number } | null;
  viewed: { handle: string; views: number }[];
}

const rupees = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function InsightsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (window: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/insights?days=${window}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const answeredRate =
    data && data.searches.total > 0
      ? Math.round((data.searches.answered / data.searches.total) * 100)
      : null;

  return (
    <main className="min-h-screen bg-sand/30 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-deep-ink">Insights</h1>
            <p className="mt-2 max-w-xl font-sans text-sm text-muted-ink">
              What people looked for, where baskets stopped, and what came in. Recorded
              by the shop itself — no tracker, no cookie.
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => setDays(window)}
                className={`rounded-full border px-4 py-1.5 font-sans text-xs transition-colors ${
                  window === days
                    ? "border-terracotta bg-terracotta text-surface"
                    : "border-sand-border text-deep-ink hover:border-terracotta"
                }`}
              >
                {window} days
              </button>
            ))}
          </div>
        </header>

        {error && (
          <p className="mt-6 border border-sindoor/30 bg-sindoor/5 p-3 font-sans text-sm text-sindoor">
            {error}
          </p>
        )}

        {loading && !data ? (
          <p className="mt-10 font-sans text-sm text-muted-ink">Reading…</p>
        ) : null}

        {data && (
          <>
            {/* The three numbers worth a glance every morning. */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-sand-border bg-surface p-5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
                  Searches
                </p>
                <p className="mt-2 font-serif text-3xl text-deep-ink">{data.searches.total}</p>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  {answeredRate == null
                    ? "Nothing searched yet"
                    : `${answeredRate}% found something`}
                </p>
              </div>
              <div className="rounded-xl border border-sand-border bg-surface p-5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
                  Baskets → orders
                </p>
                <p className="mt-2 font-serif text-3xl text-deep-ink">
                  {data.basket?.conversion == null ? "—" : `${data.basket.conversion}%`}
                </p>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  {data.basket
                    ? `${data.basket.converted} of ${data.basket.created} baskets`
                    : "Basket table unavailable"}
                </p>
              </div>
              <div className="rounded-xl border border-sand-border bg-surface p-5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
                  Taken
                </p>
                <p className="mt-2 font-serif text-3xl text-deep-ink">
                  {data.money ? rupees(data.money.captured) : "—"}
                </p>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  {data.money
                    ? `${data.money.orders} payments · ${rupees(data.money.refunded)} returned`
                    : "Payment log unavailable"}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* The catalogue's to-do list. */}
              <section className="rounded-xl border border-sand-border bg-surface p-6">
                <h2 className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-wider text-muted-ink">
                  <Icon name="search" size={15} />
                  Found nothing
                </h2>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  Asked for by name, and not in the shop. Each line is a work that would
                  have sold.
                </p>
                {data.searches.unanswered.length === 0 ? (
                  <p className="mt-5 font-sans text-sm text-muted-ink">
                    Nothing unanswered in this window.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {data.searches.unanswered.map((row) => (
                      <li
                        key={row.query}
                        className="flex items-baseline justify-between gap-3 border-b border-sand-border/60 pb-2 last:border-0"
                      >
                        <span className="font-sans text-sm text-deep-ink">{row.query}</span>
                        <span className="font-sans text-xs text-muted-ink">×{row.searches}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-sand-border bg-surface p-6">
                <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-muted-ink">
                  What people look for
                </h2>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  The words used most often, and whether the shop could answer.
                </p>
                {data.searches.top.length === 0 ? (
                  <p className="mt-5 font-sans text-sm text-muted-ink">
                    No searches recorded yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {data.searches.top.map((row) => (
                      <li
                        key={row.query}
                        className="flex items-baseline justify-between gap-3 border-b border-sand-border/60 pb-2 last:border-0"
                      >
                        <span className="font-sans text-sm text-deep-ink">{row.query}</span>
                        <span className="flex items-center gap-3 font-sans text-xs text-muted-ink">
                          <span>×{row.searches}</span>
                          <span className={row.results > 0 ? "text-leaf" : "text-sindoor"}>
                            {row.results > 0 ? `${row.results} found` : "none"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {data.viewed?.length > 0 && (
              <section className="mt-6 rounded-xl border border-sand-border bg-surface p-6">
                <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-muted-ink">
                  Looked at most
                </h2>
                <p className="mt-1 font-sans text-xs text-muted-ink">
                  Notice, which is not the same as demand: a work seen by many and bought
                  by none is a question about price or photographs, not about making more
                  of it.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {data.viewed.map((row) => (
                    <li
                      key={row.handle}
                      className="flex items-baseline justify-between gap-3 border-b border-sand-border/60 pb-2"
                    >
                      <a
                        href={`/products/${row.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
                      >
                        {row.handle}
                      </a>
                      <span className="font-sans text-xs text-muted-ink">{row.views}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.basket && data.basket.abandoned > 0 && (
              <p className="mt-6 font-sans text-xs text-muted-ink">
                {data.basket.abandoned} baskets were left behind in this window. The
                reminders that go out after 24 and 72 hours are listed in the mail log;
                a basket already reminded is not reminded again.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
