"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HeroSlide } from "@/lib/site-content";
import { KolamMotif, PaisleyBand, DiamondBand, TempleArch } from "./indian-motifs";

/**
 * The homepage hero carousel.
 *
 * Previously the arrows and the "01 — 03" counter were rendered as static
 * decoration: nothing advanced, so the slide controls were a lie. This is the
 * real thing — auto-advance, arrows, dots, keyboard, swipe, and a pause on hover
 * and focus so it never moves out from under someone reading.
 *
 * It degrades to the plain first slide when there is only one, and to no motion
 * at all under `prefers-reduced-motion`.
 */
export function HeroSlider({
  slides,
  /** Auto-advance interval in ms. 5s reads as attentive; 10s as idle. */
  interval = 5500,
}: {
  slides: HeroSlide[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (paused || count < 2) return;

    // Respect the OS setting; users who ask for less motion get a static hero.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, interval);
    return () => window.clearInterval(timer);
  }, [paused, count, interval]);

  if (count === 0) return null;

  const active = slides[index];

  return (
    <section
      className="relative min-h-[520px] overflow-hidden bg-rang-paper lg:min-h-[640px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 40) return;
        go(delta < 0 ? index + 1 : index - 1);
      }}
      aria-roledescription="carousel"
      aria-label="Featured artwork"
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          // All slides are mounted and cross-faded rather than swapped, so the
          // artwork does not flash and the layout never jumps.
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          {slide.image && (
            <Image
              src={slide.image}
              alt=""
              aria-hidden="true"
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover object-right"
            />
          )}
        </div>
      ))}

      {/* Pale wash behind the copy so the headline never fights the artwork. */}
      <div className="absolute inset-0 bg-gradient-to-r from-rang-paper from-30% via-rang-paper/70 via-50% to-transparent to-75% lg:via-rang-paper/45 lg:via-42% lg:to-65%" />

      {/* ── Indian framing ──────────────────────────────────────────────────
          A kolam in the lower-left margin and a temple arch opening at the
          left edge. Together they say "Indian art house" before a single word
          is read — which is the whole job of a hero. */}
      <KolamMotif className="pointer-events-none absolute -left-10 bottom-6 hidden h-44 w-44 text-terracotta/[0.14] md:block" />
      <TempleArch className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 text-terracotta/[0.10] lg:block" />
      <PaisleyBand className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full text-terracotta/25" />

      <div className="relative mx-auto flex max-w-[1400px] flex-col justify-center px-5 py-16 sm:px-8 lg:min-h-[640px] lg:px-12 lg:py-24">
        <div className="max-w-xl">
          {active.eyebrow && (
            <p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              {active.eyebrow}
            </p>
          )}
          <h1 className="font-serif text-[44px] font-semibold leading-[1.05] tracking-tight text-deep-ink sm:text-[60px] lg:text-[76px]">
            {active.title}
          </h1>
          {active.tagline && (
            <p className="mt-5 font-serif text-lg italic text-muted-ink sm:text-xl">
              {active.tagline}
            </p>
          )}
          <Link
            href={active.cta_href || "/shop"}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-7 py-3.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus:ring-2 focus:ring-kumkum focus:ring-offset-2 focus:ring-offset-rang-paper"
          >
            {active.cta_label || "Begin the Journey"}
            <span aria-hidden="true">→</span>
          </Link>

          {count > 1 && (
            <div className="mt-12 flex items-center gap-3 font-sans text-xs text-muted-ink">
              <span className="font-semibold text-deep-ink" aria-live="polite">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-8 bg-sand-border" aria-hidden="true" />
              <span>{String(count).padStart(2, "0")}</span>

              <span className="ml-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="Previous artwork"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum focus:outline-none focus:ring-2 focus:ring-kumkum/50"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label="Next artwork"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-border text-deep-ink transition-colors hover:border-kumkum hover:text-kumkum focus:outline-none focus:ring-2 focus:ring-kumkum/50"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </span>

              <span className="ml-3 flex items-center gap-1.5">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    aria-current={i === index ? "true" : undefined}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? "w-6 bg-kumkum"
                        : "w-1.5 bg-sand-border hover:bg-terracotta/60"
                    }`}
                  />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
