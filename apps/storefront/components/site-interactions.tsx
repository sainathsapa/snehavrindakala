"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Site-wide interaction layer.
 *
 * The paint sweep — a band of terracotta and gold that wipes across the top of
 * the viewport when a route changes, the way one gallery room gives way to the
 * next. It is 2px tall and 700ms long, so it signals the transition without
 * ever blocking the page.
 *
 * There is deliberately no custom cursor here: the system cursor is a tool and
 * replaced decoration gets in the way of the art it passes over.
 */
export function SiteInteractions() {
  const pathname = usePathname();
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSweeping(true);
    const t = window.setTimeout(() => setSweeping(false), 720);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <>
      {/* The paint sweep. `key` on the pathname restarts the animation when the
          route changes even though the bar itself never unmounts. */}
      <div
        key={pathname}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden"
      >
        <span
          className="block h-full w-full origin-left"
          style={{
            background:
              "linear-gradient(90deg, #9B2D30 0%, #C9A227 42%, #2E6B4F 100%)",
            transform: sweeping ? "scaleX(1)" : "scaleX(0)",
            opacity: sweeping ? 1 : 0,
            transition: sweeping
              ? "transform 700ms cubic-bezier(0.65,0,0.35,1), opacity 120ms"
              : "transform 0ms 200ms, opacity 300ms",
            transformOrigin: sweeping ? "left center" : "right center",
          }}
        />
      </div>
    </>
  );
}
