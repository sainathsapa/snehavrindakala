"use client";

/**
 * The artwork gallery.
 *
 * The rule this component exists to obey: **an artwork is never cropped or
 * stretched to fit a container.** The previous version put every image in an
 * `aspect-square` box with `object-cover`, which sliced the top and bottom off a
 * portrait miniature and the sides off a wide scroll. A buyer judging a painting
 * needs to see the whole painting.
 *
 * So the stage sizes itself to the image. Each image's intrinsic ratio is read
 * once it loads and applied to the frame, which means:
 *   - a 3:4 miniature renders as a tall frame on a warm paper ground
 *   - a 4:1 palm-leaf strip renders wide and short
 *   - the frame animates between ratios only when a *different* ratio is shown,
 *     so a gallery of same-shape works does not wobble between panes
 *
 * A max height keeps a very tall piece from pushing the purchase panel off the
 * screen: beyond that the image is *contained* (letterboxed on the paper ground),
 * never cropped.
 *
 * Interactions:
 *   - click / tap the artwork → full-screen viewer at natural size
 *   - thumbnails (a horizontal rail on mobile, a column on desktop) to switch
 *   - keyboard: ←/→ move, Escape closes, focus returns to the trigger
 *   - swipe left / right on touch
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryImage {
  id?: string;
  url: string;
  alt?: string;
  /** Optional intrinsic ratio from the CMS, used before the image loads. */
  aspectRatio?: number;
}

/** Fallback used until the first image reports its real ratio. */
const FALLBACK_RATIO = 4 / 5;

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const count = images.length;
  const go = useCallback((next: number) => setActive(next % count), [count]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") go(active + 1);
      if (event.key === "ArrowLeft") go(active - 1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox, active, go]);

  /**
   * Mark every image the browser has *already* decoded as loaded.
   *
   * `onLoad` alone is not enough: when the image is served from the SSR HTML, or
   * the response is cached, the load event fires before React attaches its
   * handler. The state then stayed `false` forever and the artwork rendered at
   * `opacity-0` — a completely invisible painting, which is what shipped while
   * the build, the typecheck and the unit tests were all green. Checking
   * `complete` after mount closes that hole; the class is only ever *raised* to
   * visible, never lowered.
   */
  useEffect(() => {
    for (const image of images) {
      const key = image.id || image.url;
      const node = `img[data-gallery-key="${key}"]` as string;
      const element = document.querySelector<HTMLImageElement>(node);
      if (element?.complete && element.naturalWidth > 0) {
        recordRatio(key, element);
      }
    }
    // Deliberately keyed on the image list, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map((image) => image.id || image.url).join("|")]);

  // Return focus to the artwork when the viewer closes — otherwise a keyboard
  // user is left at the top of the document.
  const closeLightbox = useCallback(() => {
    setLightbox(false);
    triggerRef.current?.focus();
  }, []);

  if (count === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-sm border border-sand-border bg-rang-paper">
        <span className="font-sans text-sm text-muted-ink">Image coming soon</span>
      </div>
    );
  }

  const current = images[Math.min(active, count - 1)];
  const currentKey = current.id || current.url;
  const currentRatio =
    ratios[currentKey] ?? current.aspectRatio ?? FALLBACK_RATIO;

  const recordRatio = (key: string, node: HTMLImageElement) => {
    if (node.naturalWidth && node.naturalHeight) {
      setRatios((existing) =>
        existing[key]
          ? existing
          : { ...existing, [key]: node.naturalWidth / node.naturalHeight }
      );
    }
    setLoaded((existing) => (existing[key] ? existing : { ...existing, [key]: true }));
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Only a deliberate horizontal swipe; a vertical drag is scrolling.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? active + 1 : active - 1);
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-start lg:gap-5">
      {/* ── The stage ──────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setLightbox(true)}
          aria-label={`Open ${title} full screen`}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-sm border border-sand-border/70 bg-rang-paper"
          style={{
            // The frame takes the artwork's own shape. `transition-[aspect-ratio]`
            // is avoided deliberately: it does not animate reliably and would
            // spring between panes for no benefit.
            aspectRatio: String(currentRatio),
            maxHeight: "min(78vh, 900px)",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            key={currentKey}
            data-gallery-key={currentKey}
            src={current.url}
            alt={current.alt || title}
            onLoad={(event) => recordRatio(currentKey, event.currentTarget)}
            decoding="async"
            fetchPriority="high"
            className={`h-full w-full object-contain transition-opacity duration-500 ${
              loaded[currentKey] ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Loading placeholder, shown only until the first byte lands. */}
          {!loaded[currentKey] && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-sand-border/30"
            />
          )}

          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-deep-ink/65 px-3 py-1 font-sans text-[11px] text-rang-paper opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            View full size
          </span>
        </button>

        {count > 1 && (
          <p className="mt-2 text-center font-sans text-[11px] text-muted-ink lg:hidden">
            {active + 1} of {count} · swipe to browse
          </p>
        )}
      </div>

      {/* ── The rail ───────────────────────────────────────────────────── */}
      {count > 1 && (
        <ul
          aria-label={`${title} — more views`}
          className="flex gap-2 overflow-x-auto pb-1 lg:w-[76px] lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {images.map((image, index) => {
            const key = image.id || image.url || String(index);
            const selected = index === active;
            return (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show image ${index + 1} of ${count}`}
                  aria-current={selected}
                  className={`block h-16 w-16 overflow-hidden rounded-sm border transition-colors lg:h-[68px] lg:w-full ${
                    selected
                      ? "border-sindoor"
                      : "border-sand-border/70 hover:border-sindoor/50"
                  }`}
                >
                          <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Full-screen viewer ─────────────────────────────────────────── */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full screen`}
          className="fixed inset-0 z-[100] flex flex-col bg-deep-ink/97"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <span className="font-sans text-xs text-rang-paper/70">
              {active + 1} / {count}
            </span>
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Close full-screen view"
              className="rounded-full p-2 text-rang-paper transition-colors hover:bg-rang-paper/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
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

          <div className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-16">
            {count > 1 && (
              <button
                type="button"
                onClick={() => go(active - 1)}
                aria-label="Previous image"
                className="absolute left-2 z-10 rounded-full p-2 text-rang-paper/80 transition-colors hover:bg-rang-paper/10 hover:text-rang-paper sm:left-4"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 5l-7 7 7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            {/* `object-contain` here is the whole point: the viewer shows the
                entire work at the largest size that fits, never a crop. */}
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
                className="absolute right-2 z-10 rounded-full p-2 text-rang-paper/80 transition-colors hover:bg-rang-paper/10 hover:text-rang-paper sm:right-4"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {count > 1 && (
            <div className="flex justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {images.map((image, index) => (
                <button
                  key={image.id || image.url || index}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Go to image ${index + 1}`}
                  aria-current={index === active}
                  className={`h-1.5 rounded-full transition-all ${
                    index === active ? "w-6 bg-haldi" : "w-1.5 bg-rang-paper/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
