import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentCustomer } from "@/lib/auth";
import { query } from "@/lib/db";
import { ReplyForm } from "@/components/support/forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support thread — SnehaVrinda Kala",
  robots: { index: false, follow: false },
};

/**
 * One thread.
 *
 * The id is checked against the signed-in customer's email before anything is
 * read, because a support thread contains an address and an order reference.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer?.email) redirect("/account/login?next=/account/support");

  const { id } = await params;
  const t = await getTranslations("support");

  const tickets = await query<any>(
    `SELECT id, subject, message, status, created_at
       FROM support_tickets
      WHERE id = $1 AND lower(email) = lower($2)`,
    [id, customer.email]
  );
  const ticket = tickets[0];
  if (!ticket) notFound();

  const replies = await query<any>(
    `SELECT id, message, author, author_type, created_at
       FROM ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [id]
  );

  const labels = {
    reply: t("reply"),
    sending: t("sending"),
    replyLabel: t("replyLabel"),
    subject: t("subjectLabel"),
    order: t("orderLabel"),
    message: t("messageLabel"),
    send: t("send"),
  };

  const when = (value: string) =>
    new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <main className="bg-rang-paper py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <nav className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-ink">
          <Link href="/account/support" className="hover:text-sindoor">
            {t("title")}
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span className="text-deep-ink">{ticket.status}</span>
        </nav>

        <h1 className="mt-5 font-serif text-3xl leading-tight text-deep-ink">
          {ticket.subject}
        </h1>
        <p className="mt-1 font-sans text-xs text-muted-ink">{when(ticket.created_at)}</p>

        <ol className="mt-8 space-y-4">
          <li className="rounded-lg border border-sand-border bg-white p-5">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink">
              {t("youWrote")}
            </p>
            <p className="mt-2 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-deep-ink/90">
              {ticket.message}
            </p>
          </li>

          {replies.map((reply: any) => (
            <li
              key={reply.id}
              className={
                reply.author_type === "admin"
                  ? "rounded-lg border border-sindoor/25 bg-sindoor/[0.04] p-5"
                  : "rounded-lg border border-sand-border bg-white p-5"
              }
            >
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink">
                {reply.author_type === "admin" ? t("studioReplied") : t("youWrote")} ·{" "}
                {when(reply.created_at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-deep-ink/90">
                {reply.message}
              </p>
            </li>
          ))}
        </ol>

        <ReplyForm ticketId={ticket.id} labels={labels} />

        <p className="mt-10 border-t border-sand-border pt-6 font-sans text-xs text-muted-ink">
          {t("threadFooter")}
        </p>
      </div>
    </main>
  );
}
