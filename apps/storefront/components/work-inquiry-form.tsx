"use client";

/**
 * "Ask about this work."
 *
 * Buying a one-of-one object is not a tap. The questions are specific — has the
 * paper been sized, can it hang in a hallway, will the frame travel — and before
 * this the only form on the site was for commissions, which reads as a different
 * thing entirely.
 *
 * The inquiry lands in `support_tickets` with the work attached, so it appears
 * in the queue staff already watch rather than creating a second place to
 * forget about.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

type State = "idle" | "sending" | "sent" | "invalid" | "failed";

export function WorkInquiryForm({
  handle,
  title,
}: {
  handle: string;
  title: string;
}) {
  const t = useTranslations("inquiry");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Question about ${title}`.slice(0, 180),
          message: question,
          email,
          name,
          product_handle: handle,
          priority: "low",
        }),
      });
      if (res.status === 400) {
        setState("invalid");
        return;
      }
      if (!res.ok) {
        setState("failed");
        return;
      }
      setState("sent");
      setQuestion("");
    } catch {
      setState("failed");
    }
  }

  if (!open) {
    return (
      <div className="border-t border-sand-border/60 pt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-sans text-sm text-terracotta underline-offset-4 transition-colors hover:text-kumkum hover:underline"
        >
          {t("open")} →
        </button>
        <p className="mt-1 font-sans text-xs text-muted-ink">{t("promise")}</p>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="border-t border-sand-border/60 pt-4" role="status" aria-live="polite">
        <p className="font-sans text-sm text-deep-ink">{t("sent")}</p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setOpen(false);
          }}
          className="mt-2 font-sans text-xs text-muted-ink underline-offset-2 hover:underline"
        >
          {t("close")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      id="work-inquiry"
      className="grid gap-3 border-t border-sand-border/60 pt-4"
    >
      <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-ink/70">
        {t("heading")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink/70">
            {t("name")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="border-b border-sand-border bg-transparent py-2 font-sans text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
        <label className="grid gap-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink/70">
            {t("email")}
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border-b border-sand-border bg-transparent py-2 font-sans text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink/70">
          {t("question")}
        </span>
        <textarea
          required
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("placeholder", { title })}
          className="resize-y border-b border-sand-border bg-transparent py-2 font-sans text-sm text-ink placeholder:text-muted-ink/40 focus:border-terracotta focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending"}
          className="border border-ink/20 px-4 py-2 font-sans text-[10px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-60"
        >
          {t("send")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-sans text-xs text-muted-ink underline-offset-2 hover:underline"
        >
          {t("cancel")}
        </button>
      </div>
      <p role="status" aria-live="polite" className="font-sans text-xs text-muted-ink">
        {state === "invalid"
          ? t("invalid")
          : state === "failed"
            ? t("failed")
            : t("replyTime")}
      </p>
    </form>
  );
}
