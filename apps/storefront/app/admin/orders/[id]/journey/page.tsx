import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/app/admin/actions";
import { getAdminOrder } from "@/lib/admin";
import { customerProfile, orderJourney, type JourneyEvent } from "@/lib/admin-journey";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order journey — SnehaVrinda Kala",
  robots: { index: false, follow: false },
};

const TONE: Record<string, string> = {
  good: "bg-leaf",
  warn: "bg-haldi",
  bad: "bg-kumkum",
};

const money = (minor: number) =>
  `₹${(Number(minor || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * One order, read as a sequence.
 *
 * The facts existed in five tables. This page puts them in the order they
 * happened, and puts the buyer beside them, so a support person can answer
 * "where is it, did you get my money, has anyone replied to me?" without opening
 * five screens.
 *
 * Support and operations both reach this page: it reads, it never writes, and the
 * permissions it asks for (`orders:read`, `customers:read`) are the ones those
 * roles already hold.
 */
export default async function OrderJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await requirePermission("orders:read"))) redirect("/admin/login");

  const { id } = await params;

  let order: any = null;
  try {
    const result = await getAdminOrder(id);
    order = result.order;
  } catch {
    notFound();
  }
  if (!order) notFound();

  const email = order.email || order.customer?.email || order.shipping_address?.email || "";
  const [events, profile] = await Promise.all([
    orderJourney({
      orderId: order.id,
      createdAt: order.created_at,
      displayId: order.display_id,
      total: order.total,
      currency: order.currency_code,
      email,
      status: order.status,
    }),
    customerProfile(email),
  ]);

  const counts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.kind] = (acc[event.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="p-6 sm:p-8">
      <div className="mb-6">
        <Link
          href={`/admin/orders/${order.id}`}
          className="font-sans text-sm text-sindoor hover:underline"
        >
          ← Back to the order
        </Link>
        <p className="mt-4 font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
          Journey
        </p>
        <h1 className="mt-1 font-serif text-3xl text-deep-ink">
          Order #{order.display_id ?? order.id}
        </h1>
        <p className="mt-2 font-sans text-sm text-muted-ink">
          {order.status} · {money(order.total)} · {email || "no email on the order"}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ── The sequence ─────────────────────────────────────────────── */}
        <section aria-labelledby="timeline">
          <h2 id="timeline" className="mb-4 font-serif text-xl text-deep-ink">
            What happened
          </h2>

          {events.length === 0 ? (
            <p className="border border-sand-border bg-surface p-6 font-sans text-sm text-muted-ink">
              Nothing recorded yet beyond the order itself.
            </p>
          ) : (
            <ol className="relative border-l border-sand-border pl-6">
              {events.map((event: JourneyEvent, index: number) => (
                <li key={`${event.kind}-${index}`} className="relative pb-6">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full ${
                      TONE[event.flag ?? ""] ?? "bg-sand-border"
                    }`}
                  />
                  <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-muted-ink">
                    {when(event.at)} · {event.kind}
                  </p>
                  <p className="mt-0.5 font-serif text-[15px] text-deep-ink">{event.title}</p>
                  {event.detail && (
                    <p className="font-sans text-[13px] text-muted-ink">{event.detail}</p>
                  )}
                  {event.ref && (
                    <p className="mt-0.5 break-all font-mono text-[11px] text-muted-ink/80">
                      {event.ref}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          <p className="mt-6 font-sans text-[11px] text-muted-ink">
            Counted: {Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(" · ") || "nothing yet"}
          </p>
        </section>

        {/* ── The buyer ────────────────────────────────────────────────── */}
        <aside aria-labelledby="buyer" className="space-y-4">
          <div className="border border-sand-border bg-surface p-4">
            <h2 id="buyer" className="font-serif text-lg text-deep-ink">
              Buyer
            </h2>
            <p className="mt-1 break-all font-sans text-[13px] text-muted-ink">{email || "—"}</p>

            <dl className="mt-4 space-y-2 font-sans text-[13px]">
              {[
                ["Orders", String(profile.orders)],
                ["Lifetime value", money(profile.lifetimeValueMinor)],
                ["Refunded", money(profile.refundedMinor)],
                ["Failed payments", String(profile.failedPayments)],
                ["Tickets", profile.tickets ? `${profile.tickets} (${profile.openTickets} open)` : "0"],
                ["Wishlist", String(profile.wishlist)],
                ["First order", profile.firstOrderAt ? when(profile.firstOrderAt) : "—"],
                ["Last order", profile.lastOrderAt ? when(profile.lastOrderAt) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-ink">{label}</dt>
                  <dd className="text-right text-deep-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-sand-border pt-4 font-sans text-[12px]">
              <Link href={`/admin/tickets?email=${encodeURIComponent(email)}`} className="text-sindoor hover:underline">
                Tickets
              </Link>
              <Link href="/admin/payments" className="text-sindoor hover:underline">
                Payment log
              </Link>
              <Link href="/admin/returns" className="text-sindoor hover:underline">
                Returns
              </Link>
            </div>
          </div>

          <div className="border border-sand-border bg-surface p-4">
            <h2 className="font-serif text-lg text-deep-ink">Delivering to</h2>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-muted-ink">
              {[order.shipping_address?.address_1, order.shipping_address?.city, order.shipping_address?.province, order.shipping_address?.postal_code]
                .filter(Boolean)
                .join(", ") || "No address on this order"}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
