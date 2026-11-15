"use client";

/**
 * Recently viewed artworks.
 *
 * A returning browser should be able to pick up where they left off. Visits are
 * recorded in localStorage (no account, no server round trip, and nothing that
 * can leak another customer's history). The snapshot stores just what a card
 * needs — handle, title, image, price — so rendering is instant on the next
 * visit without refetching each product.
 *
 * `RecordRecentlyViewed` writes; `RecentlyViewed` reads and renders.
 */

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

const KEY = "svk:recently-viewed";
const MAX = 8;

export interface RecentEntry {
  handle: string;
  title: string;
  image?: string;
  price?: number | null;
  currency?: string;
}

function read(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // Storage full or disabled — recently viewed is a convenience, not core.
  }
}

export function RecordRecentlyViewed(props: RecentEntry) {
  useEffect(() => {
    if (!props.handle) return;
    const existing = read().filter((e) => e.handle !== props.handle);
    write([{ ...props }, ...existing]);
  }, [
    props.handle,
    props.title,
    props.image,
    props.price,
    props.currency,
  ]);
  return null;
}

export function RecentlyViewed({ excludeHandle }: { excludeHandle?: string }) {
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setEntries(read());
  }, []);

  const visible = entries.filter((e) => e.handle !== excludeHandle).slice(0, 4);
  if (visible.length === 0) return null;

  return (
    <section className="mt-20 border-t border-sand-border/60 pt-12">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
        Recently viewed
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        {visible.map((entry) => (
          <Link key={entry.handle} href={`/products/${entry.handle}`} className="group">
            <div className="relative aspect-[4/5] overflow-hidden bg-surface ring-1 ring-sand-border/50">
              {entry.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.image}
                  alt={entry.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
              ) : (
                <span className="block h-full w-full" />
              )}
            </div>
            <h3 className="mt-3 font-serif text-sm font-semibold leading-tight text-deep-ink transition-colors group-hover:text-kumkum">
              {entry.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
