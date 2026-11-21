/**
 * The letter list, for whoever writes the letters.
 *
 * Before this page the list did not exist at all: the footer posted to a route
 * that had never been written, so there was nothing to read, export or remove
 * an address from. A subscriber list you cannot see is not a list.
 *
 * Server-rendered rather than fetched: it is a small, slow-changing table and a
 * server component cannot flash an empty state before the rows arrive.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/actions";
import { countSubscribers, listSubscribers } from "@/lib/newsletter";
import { listWorkAlerts, matchesWork } from "@/lib/work-alerts";
import { listCatalogue } from "@/lib/catalogue";
import { listAllArtForms } from "@/lib/site-content";
import {
  deleteAlertAction,
  deleteSubscriberAction,
  markAlertNotifiedAction,
  unsubscribeSubscriberAction,
} from "./actions";

export const dynamic = "force-dynamic";

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function NewsletterPage() {
  if (!(await requireAdmin())) redirect("/admin/login");

  let subscribers: Awaited<ReturnType<typeof listSubscribers>> = [];
  let counts = { active: 0, total: 0 };
  let failed = false;

  try {
    [subscribers, counts] = await Promise.all([listSubscribers(), countSubscribers()]);
  } catch (error) {
    console.error("Could not read the letter list", error);
    failed = true;
  }

  // "Tell me when the next one arrives" is a different list: it has a
  // tradition and a budget, so it is shown with the works that would satisfy
  // it rather than as an undifferentiated email column.
  let alerts: Awaited<ReturnType<typeof listWorkAlerts>> = [];
  let works: Awaited<ReturnType<typeof listCatalogue>> = [];
  try {
    alerts = await listWorkAlerts();
  } catch (error) {
    console.error("Could not read the work alerts", error);
  }
  try {
    works = await listCatalogue();
  } catch (error) {
    console.error("Could not read the catalogue for work alerts", error);
  }

  const artFormNames = new Map<string, string>();
  try {
    for (const form of await listAllArtForms()) {
      artFormNames.set(form.slug, form.name);
    }
  } catch (error) {
    console.error("Could not read the art forms for work alerts", error);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Letters</h1>
          <p className="mt-1 max-w-2xl font-sans text-sm text-ink/60">
            People who asked to hear about new work. One row per address, with the
            language they signed up in and when they agreed. Unsubscribing keeps the
            row so a later import cannot add them back; delete is for erasure
            requests.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-serif text-2xl text-ink">{counts.active}</p>
            <p className="font-sans text-[10px] uppercase tracking-wider text-ink/50">
              subscribed
            </p>
          </div>
          {counts.total > counts.active && (
            <div className="text-right">
              <p className="font-serif text-2xl text-ink/50">
                {counts.total - counts.active}
              </p>
              <p className="font-sans text-[10px] uppercase tracking-wider text-ink/40">
                unsubscribed
              </p>
            </div>
          )}
          <a
            href="/api/admin/export?type=newsletter"
            className="rounded border border-sand-border px-3 py-2 font-sans text-[11px] uppercase tracking-wider text-ink/70 transition-colors hover:border-terracotta hover:text-terracotta"
          >
            Export CSV
          </a>
        </div>
      </header>

      {failed ? (
        <p className="rounded border border-sand-border bg-white/60 p-4 font-sans text-sm text-ink/70">
          The list could not be read right now. Nothing has been lost — the signup
          route writes to the same table.
        </p>
      ) : subscribers.length === 0 ? (
        <p className="rounded border border-dashed border-sand-border p-6 font-sans text-sm text-ink/60">
          No one has joined the list yet. The signup sits in the footer of every
          page, under “Letters from the art house”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-sand-border">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-sand-border bg-white/60">
                {["Email", "Language", "From", "Joined", ""].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2 font-sans text-[10px] uppercase tracking-wider text-ink/50"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.map((row) => (
                <tr key={row.id} className="border-b border-sand-border/60 last:border-0">
                  <td className="px-3 py-2 font-sans text-sm text-ink">{row.email}</td>
                  <td className="px-3 py-2 font-sans text-xs uppercase text-ink/60">
                    {row.locale}
                  </td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/60">{row.source}</td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/60">
                    {when(row.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <form action={unsubscribeSubscriberAction}>
                        <input type="hidden" name="email" value={row.email} />
                        <button
                          type="submit"
                          className="font-sans text-[11px] uppercase tracking-wider text-ink/50 underline-offset-2 hover:text-terracotta hover:underline"
                        >
                          Unsubscribe
                        </button>
                      </form>
                      <form action={deleteSubscriberAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="font-sans text-[11px] uppercase tracking-wider text-ink/40 underline-offset-2 hover:text-[#8a2c14] hover:underline"
                        >
                          Erase
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Waiting for a work</h2>
          <p className="mt-1 max-w-2xl font-sans text-sm text-ink/60">
            Visitors who asked to hear about the next work in a tradition, with the
            budget they gave. The works listed beside each one already fit, so this is
            a list to write from — nothing is sent automatically.
          </p>
        </div>

        {alerts.length === 0 ? (
          <p className="rounded border border-dashed border-sand-border p-6 font-sans text-sm text-ink/60">
            No one is waiting yet. The form sits on each tradition page, under
            “The next…”
          </p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => {
              const priceMax = alert.price_max === null ? null : Number(alert.price_max);
              const fits = works
                .filter((work) =>
                  matchesWork({ art_form: alert.art_form, price_max: priceMax }, work)
                )
                .slice(0, 4);
              return (
                <li
                  key={alert.id}
                  className="rounded border border-sand-border bg-white/60 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-sans text-sm text-ink">{alert.email}</p>
                      <p className="mt-0.5 font-sans text-xs text-ink/55">
                        {alert.art_form
                          ? artFormNames.get(alert.art_form) ?? alert.art_form
                          : "Any tradition"}
                        {priceMax !== null
                          ? ` · up to ₹${priceMax.toLocaleString("en-IN")}`
                          : " · no budget limit"}
                        {` · waiting since ${when(alert.created_at)}`}
                        {alert.notified_at ? ` · written to ${when(alert.notified_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <form action={markAlertNotifiedAction}>
                        <input type="hidden" name="id" value={alert.id} />
                        <button
                          type="submit"
                          className="font-sans text-[11px] uppercase tracking-wider text-ink/50 underline-offset-2 hover:text-terracotta hover:underline"
                        >
                          Mark written
                        </button>
                      </form>
                      <form action={deleteAlertAction}>
                        <input type="hidden" name="id" value={alert.id} />
                        <button
                          type="submit"
                          className="font-sans text-[11px] uppercase tracking-wider text-ink/40 underline-offset-2 hover:text-[#8a2c14] hover:underline"
                        >
                          Erase
                        </button>
                      </form>
                    </div>
                  </div>

                  {fits.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {fits.map((work) => (
                        <li key={work.handle}>
                          <Link
                            href={`/products/${work.handle}`}
                            className="font-sans text-xs text-terracotta underline-offset-2 hover:underline"
                          >
                            {work.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 font-sans text-xs text-ink/45">
                      Nothing in the catalogue fits yet.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="font-sans text-xs text-ink/50">
        Signups are stored, not mailed: outbound mail stays a no-op until SES is
        configured (see <Link href="/admin/settings" className="underline">Settings</Link>{" "}
        and <code>docs/DEPLOY.md</code>).
      </p>
    </div>
  );
}
