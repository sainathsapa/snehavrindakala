"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Interactive layer — the part of an art site that *responds to the hand*.
 *
 * A painting does not change when you look at it, but a website that behaves
 * like paint does. These pieces are drawn from how pigments and brushes behave:
 * ink bleeding from the cursor, a thread that follows a link, a plate that lifts
 * toward you, a stroke that paints itself in as you scroll.
 *
 * Every effect here is:
 *  - disabled under `prefers-reduced-motion`,
 *  - skipped on touch devices where there is no cursor,
 *  - additive only — content is fully visible and usable without it.
 */

/** True only for a real hover-capable pointer, so phones never get ghost ink. */
function useHoverPointer() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setOk(mq.matches && !reduce.matches);
    sync();
    mq.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);
  return ok;
}

/* ── Magnetic link ──────────────────────────────────────────────────────
   Buttons lean toward the cursor within a small radius, then spring back. The
   physicality is what makes a link feel like an object rather than a word. */
export function Magnetic({
  children,
  strength = 14,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const enabled = useHoverPointer();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const radius = Math.max(r.width, r.height) / 2 + 60;
      if (dist < radius) {
        const pull = 1 - dist / radius;
        target.x = (dx / radius) * strength * pull;
        target.y = (dy / radius) * strength * pull;
      } else {
        target.x = 0;
        target.y = 0;
      }
    };

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.16;
      cur.y += (target.y - cur.y) * 0.16;
      el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [enabled, strength]);

  return (
    <span ref={ref} className={`inline-block will-change-transform ${className}`}>
      {children}
    </span>
  );
}

/* ── Tilt plate ──────────────────────────────────────────────────────────
   An artwork on a gallery wall catches the light as you walk past it. This
   tilts a card in 3D toward the cursor, with a soft sheen that tracks the
   pointer, so a thumbnail behaves like a framed object. */
export function TiltPlate({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const enabled = useHoverPointer();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let raf = 0;
    const cur = { rx: 0, ry: 0 };
    const tar = { rx: 0, ry: 0, gx: 50, gy: 50 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tar.ry = (px - 0.5) * 2 * max;
      tar.rx = -(py - 0.5) * 2 * max;
      tar.gx = px * 100;
      tar.gy = py * 100;
    };
    const onLeave = () => {
      tar.rx = 0;
      tar.ry = 0;
      tar.gx = 50;
      tar.gy = 50;
    };

    const tick = () => {
      cur.rx += (tar.rx - cur.rx) * 0.12;
      cur.ry += (tar.ry - cur.ry) * 0.12;
      el.style.transform = `perspective(900px) rotateX(${cur.rx}deg) rotateY(${cur.ry}deg)`;
      el.style.setProperty("--sheen-x", `${tar.gx}%`);
      el.style.setProperty("--sheen-y", `${tar.gy}%`);
      raf = requestAnimationFrame(tick);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [enabled, max]);

  return (
    <div
      ref={ref}
      className={`relative will-change-transform [transform-style:preserve-3d] ${className}`}
      style={{
        background:
          "radial-gradient(circle at var(--sheen-x,50%) var(--sheen-y,50%), rgba(255,255,255,0.16), transparent 55%)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Painted stroke reveal ───────────────────────────────────────────────
   A section's content is revealed by a mask that sweeps across it the way a
   brush lays down a wash — left to right, slightly soft at the edge — instead
   of simply fading in. */
export function PaintReveal({
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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      setShown(true);
      return;
    }
    // Fail safe: if the observer never fires (unsupported, or the element is
    // already off-screen in a way that confuses it), show the content anyway.
    const failSafe = window.setTimeout(() => setShown(true), 2200);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => {
      window.clearTimeout(failSafe);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[clip-path,opacity] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        clipPath: shown
          ? "inset(0 0 0 0)"
          : "inset(0 100% 0 0)",
        opacity: shown ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── Ink underline ───────────────────────────────────────────────────────
   Links get a hand-drawn underline that draws itself on hover — a stroke, not
   a CSS border, so it has a slight overshoot at each end like a brush. */
export function InkLink({
  children,
  className = "",
  tone = "ink",
}: {
  children: ReactNode;
  className?: string;
  tone?: "ink" | "paper";
}) {
  const stroke = tone === "paper" ? "currentColor" : "currentColor";
  return (
    <span className={`group/ink relative inline-block ${className}`}>
      {children}
      <svg
        viewBox="0 0 200 8"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute -bottom-1 left-0 h-1.5 w-full"
      >
        <path
          d="M2 5c34-3 74-4 108-3s62 3 88 1"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
          className="opacity-0 transition-opacity duration-200 group-hover/ink:opacity-100 group-hover/ink:[stroke-dasharray:200] group-hover/ink:[stroke-dashoffset:0]"
          style={{
            strokeDasharray: 200,
            strokeDashoffset: 200,
            transition: "stroke-dashoffset 480ms cubic-bezier(0.22,1,0.36,1), opacity 160ms",
          }}
        />
      </svg>
    </span>
  );
}

/* ── Ripple click ────────────────────────────────────────────────────────
   A dot of pigment spreads from the point of a click. Used on primary buttons
   so pressing one feels like touching wet paint. */
export function useInkRipple() {
  return (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const span = document.createElement("span");
    const size = Math.max(r.width, r.height) * 2.2;
    span.style.cssText = `
      position:absolute;border-radius:9999px;pointer-events:none;
      left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;
      width:${size}px;height:${size}px;
      background:radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%);
      transform:scale(0);opacity:1;
    `;
    // The button must be positioned for the ripple to sit inside it.
    const prevPos = el.style.position;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const prevOverflow = el.style.overflow;
    el.style.overflow = "hidden";
    el.appendChild(span);
    span
      .animate(
        [
          { transform: "scale(0)", opacity: 0.9 },
          { transform: "scale(1)", opacity: 0 },
        ],
        { duration: 620, easing: "cubic-bezier(0.22,1,0.36,1)" }
      )
      .addEventListener("finish", () => {
        span.remove();
        el.style.position = prevPos;
        el.style.overflow = prevOverflow;
      });
  };
}
