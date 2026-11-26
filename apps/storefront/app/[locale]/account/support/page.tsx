import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentCustomer } from "@/lib/auth";
import { query } from "@/lib/db";
import { AmbiRule } from "@/components/learn/motifs";
import { NewTicketForm } from "@/components/support/forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support — SnehaVrinda Kala",
  description: "Every message you have sent the studio, and their replies.",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-sindoor/10 text-sindoor",
  pending: "bg-haldi/20 text-deep-ink",
  answered: "bg-leaf/10 text-leaf",
  resolved: "bg-leaf/10 text-leaf",
  closed: "bg-sand-border/40 text-muted-ink",
};

/**
 * The customer's support desk.
 *
 * A buyer who writes to the studio should be able to see that they did, read the
 * reply, and answer it without hunting for an email from three weeks ago. Until
 * this page existed, a signed-in customer had no support view at all — the
 * tickets were visible only to staff.
 */
export default async function SupportPage() {
  const customer = await getCurrentCustomer();
  if (!customer?.email) redirect("/account/login?next=/account/support");

  const t = await getTranslations("support");

  let tickets: any[] = [];
  let failed = false;
  try {
    tickets = await query(
      `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at,
              (SELECT count(*) FROM ticket_replies r WHERE r.ticket_id = t.id AND r.author_type = 'admin') AS staff_replies
         FROM support_tickets t
        WHERE lower(t.email) = lower($1)
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [customer.email]
    );
  } catch (error) {
    console.error("[support] list failed", error);
    failed = true;
  }

  const labels = {
    subject: t("subjectLabel"),
    order: t("orderLabel"),
    message: t("messageLabel"),
    send: t("send"),
    sending: t("sending"),
    reply: t("reply"),
    replyLabel: t("replyLabel"),
  };

  return (
    <main className="bg-rang-paper py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <nav className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-ink">
          <Link href="/account" className="hover:text-sindoor">
            {t("account")}
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span className="text-deep-ink">{t("title")}</span>
        </nav>

        <h1 className="mt-5 font-serif text-4xl leading-tight text-deep-ink">{t("title")}</h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted-ink">
          {t("intro")}
        </p>

        <section className="mt-10">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-ink">
            {t("yourMessages")}
          </h2>

          {failed ? (
            <p className="mt-3 font-sans text-sm text-terracotta">{t("failed")}</p>
          ) : tickets.length === 0 ? (
            <p className="mt-3 border-t border-sand-border pt-4 font-serif text-[15px] italic text-muted-ink">
              {t("empty")}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-sand-border border-y border-sand-border">
              {tickets.map((ticket: any) => (
                <li key={ticket.id}>
                  <Link
                    href={`/account/support/${ticket.id}`}
                    className="group flex flex-wrap items-baseline justify-between gap-3 py-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-lg text-deep-ink group-hover:text-sindoor">
                        {ticket.subject}
                      </span>
                      <span className="mt-0.5 block font-sans text-xs text-muted-ink">
                        {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {Number(ticket.staff_replies) > 0
                          ? ` · ${ticket.staff_replies} ${t("repliesFromStudio")}`
                          : ` · ${t("noReplyYet")}`}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        STATUS_TONE[String(ticket.status)] ?? STATUS_TONE.closed
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AmbiRule className="mt-12 h-5 w-48 text-sindoor/30" />

        <section className="mt-8">
          <h2 className="font-serif text-2xl text-deep-ink">{t("newHeading")}</h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted-ink">
            {t("newBody")}
          </p>
          <NewTicketForm labels={labels} />
        </section>

        <p className="mt-10 border-t border-sand-border pt-6 font-sans text-xs leading-relaxed text-muted-ink">
          {t("fasterFooter")}{" "}
          <Link href="/contact" className="text-sindoor underline-offset-4 hover:underline">
            {t("contactLink")}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
