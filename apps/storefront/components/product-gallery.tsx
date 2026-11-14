"use client";

/**
 * Product gallery.
 *
 * A single large image, a thumbnail rail, and a full-screen view. Clicking a
 * thumbnail swaps the hero; clicking the hero opens a lightbox that fills the
 * viewport so a buyer can study brushwork and texture — the closest thing to
 * standing in front of the work that a screen allows.
 *
 * Keyboard: Escape closes the lightbox, ArrowLeft/ArrowRight move between
 * images, and every control is a real button with an accessible name.
 */

import { useCallback, useEffect, useState } from "react";

export interface GalleryImage {
  id?: string;
  url: string;
  alt?: string;
}

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const count = images.length;
  const go = useCallback(
    (next: number) => setActive((next + count) % count),
    [count]
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") go(active + 1);
      if (e.key === "ArrowLeft") go(active - 1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the lightbox is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, active, go]);

  if (count === 0) {
    return (
      <div className="relative flex aspect-square items-center justify-center rounded-sm border border-sand-border bg-rang-paper">
        <span className="font-sans text-sm text-muted-ink">
          Image coming soon
        </span>
      </div>
    );
  }

  const current = images[Math.min(active, count - 1)];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label="Open full-screen image"
        className="group relative aspect-square w-full overflow-hidden rounded-sm border border-sand-border bg-surface"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt || title}
          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-deep-ink/60 px-3 py-1 font-sans text-[11px] text-rang-paper opacity-0 transition-opacity group-hover:opacity-100">
          Click to enlarge
        </span>
      </button>

      {count > 1 && (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={img.id || img.url || i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === active}
                className={`block aspect-square w-full overflow-hidden rounded-sm border transition-colors ${
                  i === active
                    ? "border-sindoor"
                    : "border-sand-border hover:border-sindoor/60"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full-screen image`}
          className="fixed inset-0 z-[100] flex flex-col bg-deep-ink/95 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-sans text-xs text-rang-paper/70">
              {active + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close full-screen image"
              className="rounded-full p-2 text-rang-paper transition-colors hover:bg-rang-paper/10"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4">
            {count > 1 && (
              <button
                type="button"
                onClick={() => go(active - 1)}
                aria-label="Previous image"
                className="absolute left-2 rounded-full p-2 text-rang-paper/80 transition-colors hover:bg-rang-paper/10 hover:text-rang-paper"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt || title}
              className="max-h-full max-w-full object-contain"
            />
            {count > 1 && (
              <button
                type="button"
                onClick={() => go(active + 1)}
                aria-label="Next image"
                className="absolute right-2 rounded-full p-2 text-rang-paper/80 transition-colors hover:bg-rang-paper/10 hover:text-rang-paper"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
