"use client";

/** Print — the certificate page is designed to be saved as a PDF by the browser. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-ink/20 px-4 py-2 font-sans text-[10px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-terracotta hover:text-terracotta print:hidden"
    >
      {label}
    </button>
  );
}
