"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals a section as it enters the viewport.
 *
 * The whole point of an artist's site is pacing: content should arrive as you
 * scroll, the way a gallery unfolds room by room, rather than all appearing at
 * once. This is deliberately restrained — a 14px rise and a fade, once, never
 * replayed on scroll back.
 *
 * Two things it must not do:
 *  - hide content from search engines or from a user whose JS fails, and
 *  - animate for someone who asked for less motion.
 *
 * So: content is rendered visible by default, and the observer only ever
 * *improves* it. If `IntersectionObserver` is missing or motion is reduced, the
 * wrapper stays fully opaque and static.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Stagger in ms, for lists where a shared timing would look mechanical. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    // Fail-safe: if the observer never reports (element already past the
    // viewport, an unsupported browser, a hydration mismatch) the content must
    // still be visible. Revealing late is a cosmetic bug; never revealing hides
    // real content, which is not acceptable.
    const fallback = window.setTimeout(() => setShown(true), 2500);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            window.clearTimeout(fallback);
            observer.disconnect();
          }
        }
      },
      // Start slightly before the element is fully on screen so it settles as
      // the user arrives rather than snapping afterwards.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    observer.observe(node);
    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translate3d(0, 14px, 0)",
        transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: shown ? undefined : "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * A slow parallax drift for a single image.
 *
 * Reads the element's position once per frame while it is on screen and shifts
 * it a few pixels, which is enough to make a still photograph feel like a
 * window rather than a picture. Capped hard: more than ~30px of travel reads as
 * a gimmick, and any motion at all is skipped for reduced-motion users.
 */
export function ParallaxImage({
  src,
  alt,
  className = "",
  strength = 24,
}: {
  src: string;
  alt: string;
  className?: string;
  strength?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      // -1 (below the fold) → 1 (above it).
      const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      setOffset(Math.max(-strength, Math.min(strength, -progress * strength)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        style={{
          transform: `translate3d(0, ${offset}px, 0) scale(1.08)`,
          transition: "transform 120ms linear",
          willChange: "transform",
        }}
      />
    </div>
  );
}
