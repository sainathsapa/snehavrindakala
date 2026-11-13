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

/* ── Word rise ───────────────────────────────────────────────────────────
   A headline whose words rise into place one after another as it enters view,
   the way a line of type is set. Words, not letters: letters read as a loader,
   words read as language. */
export function WordRise({
  text,
  className = "",
  as: Tag = "p",
  stagger = 55,
}: {
  text: string;
  className?: string;
  as?: "p" | "h2" | "h3" | "span";
  stagger?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const failSafe = window.setTimeout(() => setShown(true), 2400);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => {
      window.clearTimeout(failSafe);
      io.disconnect();
    };
  }, []);

  const words = text.split(" ");

  return (
    <Tag
      ref={ref as never}
      className={className}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span
            className="inline-block transition-[transform,opacity] duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: shown ? "translateY(0)" : "translateY(105%)",
              opacity: shown ? 1 : 0,
              transitionDelay: `${i * stagger}ms`,
            }}
          >
            {word}
          </span>
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </Tag>
  );
}

/* ── Curtain plate ───────────────────────────────────────────────────────
   An image revealed by a blind lifting off it, rather than a fade. The frame
   is on parchment, the blind is the parchment itself, so an artwork appears to
   be uncovered on the wall. */
export function CurtainPlate({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const failSafe = window.setTimeout(() => setShown(true), 2600);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => {
      window.clearTimeout(failSafe);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 origin-top bg-rang-paper transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{
          transform: shown ? "scaleY(0)" : "scaleY(1)",
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

/* ── Scroll drift ────────────────────────────────────────────────────────
   Slow horizontal drift tied to vertical scroll — the artwork column slides a
   little as the page moves, which is what makes a gallery page feel deep rather
   than flat. Capped so it never travels far enough to misalign. */
export function ScrollDrift({
  children,
  className = "",
  distance = 40,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // -1 when the element is just below the fold, +1 when just above it.
      const progress = (vh - r.top) / (vh + r.height);
      const clamped = Math.max(0, Math.min(1, progress));
      el.style.transform = `translate3d(${(clamped - 0.5) * distance}px, 0, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [distance]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}
