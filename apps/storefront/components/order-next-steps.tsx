/**
 * "What happens next" for a just-placed order.
 *
 * A buyer who has paid needs to know what is happening and when, in plain
 * words. Medusa/our backend statuses are operational states ("awaiting",
 * "fulfilled"); this maps them onto the four beats a customer actually cares
 * about — received, preparing, shipped, delivered — and marks where they are.
 *
 * It renders nothing once the order is delivered, because the timeline has
 * served its purpose and the shipment/tracking sections take over.
 */
const BEATS = [
  {
    key: "placed",
    title: "Order received",
    body: "We have your order and payment. A confirmation is on its way.",
  },
  {
    key: "preparing",
    title: "Being prepared",
    body: "Your work is packed by the studio with care, ready for dispatch.",
  },
  {
    key: "shipped",
    title: "On its way",
    body: "Handed to the courier. Tracking details appear below once scanned.",
  },
  {
    key: "delivered",
    title: "Delivered",
    body: "Reached your address. Reach out if anything is not right.",
  },
] as const;

/** Which beat a raw status maps to. Unknown statuses default to "placed". */
function progressFrom(status?: string | null, hasShipment = false): number {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "delivered") return 3;
  if (s === "shipped" || s === "fulfilled" || s === "partially_fulfilled")
    return 2;
  if (s === "processing" || s === "pending" || s === "awaiting") {
    return hasShipment ? 2 : 1;
  }
  // No explicit backend status: if a shipment exists we are at least shipped.
  return hasShipment ? 2 : 0;
}

export function OrderNextSteps({
  status,
  paymentStatus,
  hasShipment,
}: {
  status?: string | null;
  paymentStatus?: string | null;
  hasShipment?: boolean;
}) {
  const current = progressFrom(status, hasShipment);
  if (current >= 3) return null;

  const paid = (paymentStatus || "").toLowerCase() === "captured" ||
    (paymentStatus || "").toLowerCase() === "paid";

  return (
    <section
      className="mb-8 rounded-xl border border-sand-border bg-surface p-6 sm:p-8"
      aria-labelledby="next-steps-heading"
    >
      <h2
        id="next-steps-heading"
        className="text-xl font-serif font-semibold text-deep-ink"
      >
        What happens next
      </h2>
      {paid && (
        <p className="mt-1 text-sm text-muted-ink font-sans">
          Payment received. Nothing else is needed from you right now.
        </p>
      )}

      <ol className="mt-6 grid gap-4 sm:grid-cols-4">
        {BEATS.map((beat, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={beat.key} className="relative">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                      ? "bg-sindoor text-rang-paper"
                      : active
                        ? "border-2 border-sindoor text-sindoor"
                        : "border border-sand-border text-muted-ink"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`text-sm font-medium ${
                    done || active ? "text-deep-ink" : "text-muted-ink"
                  }`}
                >
                  {beat.title}
                </span>
              </div>
              <p className="mt-1.5 pl-8 font-sans text-xs leading-relaxed text-muted-ink">
                {beat.body}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
