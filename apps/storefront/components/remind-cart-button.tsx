"use client";

/**
 * One button, one reminder.
 *
 * The server refuses a second send for the same cart; this component shows that
 * refusal in words rather than pretending the button worked.
 */

import { useState } from "react";

export function RemindCartButton({
  cartId,
  alreadyReminded,
  reminderStatus,
}: {
  cartId: string;
  alreadyReminded: boolean;
  reminderStatus: string | null;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (alreadyReminded) {
    return (
      <p className="font-sans text-xs text-muted-ink">
        {reminderStatus === "sent"
          ? "Reminder sent."
          : reminderStatus === "skipped"
            ? "Recorded, but no email was sent (no mail transport configured)."
            : "Reminder attempted and failed."}
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={state !== "idle"}
        onClick={async () => {
          setState("sending");
          try {
            const res = await fetch("/api/admin/carts/remind", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cart_id: cartId }),
            });
            const data = await res.json();
            setMessage(data.note || data.error || "Done.");
          } catch {
            setMessage("The reminder could not be sent.");
          } finally {
            setState("done");
          }
        }}
        className="justify-self-start border border-sand-border px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send reminder"}
      </button>
      {message && (
        <p role="status" className="font-sans text-xs text-muted-ink">
          {message}
        </p>
      )}
    </div>
  );
}
