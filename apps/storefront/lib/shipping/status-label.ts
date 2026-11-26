/**
 * Shipment status, in words a buyer understands.
 *
 * Shiprocket reports its own vocabulary (`PICKUP PENDING`, `IN TRANSIT`,
 * `UNDELIVERED`, numeric codes on some events, and the local statuses this app
 * stores). Rendering the raw value gave a customer "picked_up" or
 * "out_for_delivery" — machine words on the one page where they are anxious.
 *
 * Unknown values are not hidden: they are title-cased, because showing a status
 * we do not recognise is better than showing nothing at all.
 */

export type ShipmentTone = "neutral" | "progress" | "done" | "problem";

const LABELS: Record<string, { label: string; tone: ShipmentTone }> = {
  pending: { label: "Preparing", tone: "neutral" },
  label_created: { label: "Label created", tone: "neutral" },
  pickup_pending: { label: "Awaiting pickup", tone: "neutral" },
  pickup_scheduled: { label: "Pickup scheduled", tone: "neutral" },
  picked_up: { label: "Picked up", tone: "progress" },
  shipped: { label: "Shipped", tone: "progress" },
  in_transit: { label: "In transit", tone: "progress" },
  out_for_delivery: { label: "Out for delivery", tone: "progress" },
  delivered: { label: "Delivered", tone: "done" },
  rto: { label: "Returning to studio", tone: "problem" },
  rto_in_transit: { label: "Returning to studio", tone: "problem" },
  returned: { label: "Returned to studio", tone: "problem" },
  undelivered: { label: "Delivery attempt failed", tone: "problem" },
  cancelled: { label: "Shipment cancelled", tone: "problem" },
  lost: { label: "Reported lost", tone: "problem" },
};

function normalise(status: string): string {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function shipmentStatusLabel(status: string | null | undefined): {
  label: string;
  tone: ShipmentTone;
} {
  const key = normalise(status || "");
  if (!key) return { label: "Preparing", tone: "neutral" };
  const known = LABELS[key];
  if (known) return known;
  const title = key
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  return { label: title || "Preparing", tone: "neutral" };
}

/** Tailwind classes per tone, kept here so every surface agrees. */
export function shipmentStatusClasses(tone: ShipmentTone): string {
  switch (tone) {
    case "done":
      return "bg-leaf/10 text-leaf";
    case "progress":
      return "bg-sindoor/10 text-sindoor";
    case "problem":
      return "bg-terracotta/10 text-terracotta";
    default:
      return "bg-sand-border/40 text-muted-ink";
  }
}
