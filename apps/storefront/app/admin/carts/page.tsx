/**
 * Unfinished checkouts.
 *
 * Somebody chose a one-of-one work, gave their email, and left. There was no way
 * to see that, let alone do anything about it. This is the list, with one
 * reminder per cart and no second one.
 *
 * Server-rendered: it is a small table and it should not flash empty while a
 * fetch runs.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/actions";
import { abandonedAfterHours, listAbandonedCarts } from "@/lib/abandoned-carts";
import { RemindCartButton } from "@/components/remind-cart-button";

export const dynamic = "force-dynamic";

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "INR").toUpperCase(),
    maximumFractionDigits: 0,
  }).format((minor || 0) / 100);

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AbandonedCartsPage() {
  if (!(await requireAdmin())) redirect("/admin/login");

  let carts: Awaited<ReturnType<typeof listAbandonedCarts>> = [];
  let failed = false;
  try {
    carts = await listAbandonedCarts({ limit: 100 });
  } catch (error) {
    console.error("Could not read the carts", error);
    failed = true;
  }

  const mailConfigured = Boolean(
    process.env.FROM_EMAIL && process.env.AWS_SES_REGION
  );
  const waiting = carts.filter((cart) => !cart.reminded_at);
  const value = waiting.reduce((sum, cart) => sum + cart.subtotal, 0);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Unfinished checkouts
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm text-muted-ink">
            Carts untouched for {abandonedAfterHours()} hours that never became an
            order. Each one gets a single reminder — after that the shop stops
            asking, because a one-of-one work is not a subscription.
          </p>
        </header>

        {!mailConfigured && (
          <p className="mb-6 border-l-2 border-terracotta bg-terracotta/5 px-3 py-2 font-sans text-sm text-terracotta">
            Email is not configured on this deployment, so a reminder will be
            recorded as <strong>skipped</strong> rather than sent. Set{" "}
            <code>FROM_EMAIL</code> and the <code>AWS_SES_*</code> credentials to
            make these real.
          </p>
        )}

        <p className="mb-4 font-sans text-xs text-muted-ink">
          One reminder per cart, and carts whose work has sold are not listed.
        </p>

        {failed ? (
          <p className="border-l-2 border-sindoor bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor">
            The carts could not be read. Nothing was lost — this list is derived
            from Medusa&rsquo;s own cart tables.
          </p>
        ) : carts.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
            <p className="font-sans text-sm text-deep-ink">
              No unfinished checkouts right now.
            </p>
            <p className="mt-1 font-sans text-xs text-muted-ink">
              Carts appear here {abandonedAfterHours()} hours after the last
              activity, and only if they have an email address. Carts holding a
              work that has since sold are left out — there is nothing to come
              back to.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 font-sans text-sm text-muted-ink">
              {waiting.length} waiting
              {waiting.length > 0 ? ` · ${money(value, "INR")} in carts` : ""}
              {" · "}
              {carts.length} in total
            </p>

            <div className="overflow-hidden rounded-xl border border-sand-border bg-surface">
              <table className="w-full divide-y divide-sand-border text-left">
                <thead>
                  <tr>
                    {["Buyer", "What they chose", "Cart total", "Last activity", "Reminder"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 font-sans text-xs font-medium uppercase tracking-wider text-muted-ink"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {carts.map((cart) => (
                    <tr key={cart.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {cart.email || "—"}
                        <p className="font-mono text-[10px] text-muted-ink">
                          {cart.id}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        <ul className="space-y-0.5">
                          {cart.items.map((item, index) => (
                            <li key={`${cart.id}-${index}`} className="text-muted-ink">
                              {item.title}
                              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-sans text-sm text-deep-ink">
                        {money(cart.subtotal, cart.currency_code)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-sans text-sm text-muted-ink">
                        {when(cart.updated_at)}
                      </td>
                      <td className="px-6 py-4">
                        <RemindCartButton
                          cartId={cart.id}
                          alreadyReminded={Boolean(cart.reminded_at)}
                          reminderStatus={cart.reminder_status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-6 font-sans text-xs text-muted-ink">
          The reminder email says one thing only: the piece is still here and
          nothing has been charged. See{" "}
          <Link href="/admin/analytics" className="text-sindoor hover:underline">
            Analytics
          </Link>{" "}
          for what people saved and did not buy.
        </p>
      </div>
    </main>
  );
}
