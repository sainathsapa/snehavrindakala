"use client";

/**
 * Reading progress + "I have read this" for an entry page.
 *
 * A thin rule at the top of the viewport, and a single button at the end of the
 * page. Progress lives in localStorage because learning a vocabulary is
 * something a reader does over days, on one device, without an account — and
 * asking someone to sign in to tick a box would be absurd.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "svk:learn:read";

function read(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function ReadingProgress({ slug, title }: { slug: string; title: string }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(Boolean(read()[slug]));

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [slug]);

  const toggle = () => {
    const next = { ...read(), [slug]: !done };
    if (!done) next[slug] = true;
    else delete next[slug];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDone(!done);
  };

  return (
    <>
      {/* The rule that fills as you read. Fixed and 2px: present, never loud. */}
      <div
        aria-hidden
        className="fixed left-0 top-0 z-50 h-[2px] bg-sindoor transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        className={`group mt-12 flex w-full items-center justify-between gap-4 border-t border-sand-border pt-6 text-left font-sans text-sm transition-colors ${
          done ? "text-leaf" : "text-muted-ink hover:text-deep-ink"
        }`}
      >
        <span className="flex items-center gap-3">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${
              done ? "border-leaf bg-leaf text-white" : "border-sand-border"
            }`}
          >
            {done ? "✓" : ""}
          </span>
          <span>
            {done ? `Marked as read` : `I have read this`}
            <span className="block text-xs text-muted-ink/70">{title}</span>
          </span>
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-ink/60">
          kept on this device
        </span>
      </button>
    </>
  );
}
