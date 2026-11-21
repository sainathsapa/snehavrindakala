"use client";

/**
 * The letter signup.
 *
 * Posts to `/api/newsletter`. That route did not exist until now, so every
 * address typed into the footer was met with a 404 and lost — on a shop whose
 * works are sold once, the signup is the only way a visitor can ask to hear
 * about the next one.
 *
 * The form still submits without JavaScript because `action` and `method` are
 * set. With JavaScript it answers in place, since reloading the page someone is
 * reading to say "thank you" is a worse trade than a line of text.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type State = "idle" | "sending" | "ok" | "exists" | "invalid" | "failed";

export function LetterForm() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    if (typeof fetch !== "function") return; // Let the browser post the form.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "fetch",
        },
        body: JSON.stringify({
          email: form.get("email"),
          consent: form.get("consent"),
          locale,
          source: "footer",
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        reason?: string;
      } | null;
      if (!res.ok) {
        setState(body?.reason === "invalid" ? "invalid" : "failed");
        return;
      }
      setState(body?.reason === "already" ? "exists" : "ok");
      if (body?.reason !== "already") setEmail("");
    } catch {
      setState("failed");
    }
  }

  const message =
    state === "ok"
      ? t("letterThanks")
      : state === "exists"
        ? t("letterAlready")
        : state === "invalid"
          ? t("letterInvalid")
          : state === "failed"
            ? t("letterFailed")
            : null;

  return (
    <form
      id="letters"
      action="/api/newsletter"
      method="POST"
      onSubmit={submit}
      className="mt-8 max-w-sm"
    >
      <input type="hidden" name="locale" value={locale} />
      <label
        htmlFor="footer-email"
        className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-haldi/70"
      >
        {t("lettersHeading")}
      </label>
      <div className="mt-2.5 flex items-center gap-3 border-b border-rang-paper/25 pb-2 focus-within:border-haldi/70">
        <input
          id="footer-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          aria-describedby={message ? "footer-letter-status" : undefined}
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-rang-paper placeholder:text-rang-paper/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-haldi transition-colors hover:text-rang-paper disabled:opacity-60"
        >
          Send
        </button>
      </div>
      <label className="mt-2.5 flex items-start gap-2 font-sans text-[10px] leading-snug text-rang-paper/65">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 h-3 w-3 shrink-0 cursor-pointer appearance-none border border-rang-paper/40 bg-transparent transition-colors checked:border-haldi checked:bg-haldi"
        />
        <span>{t("consent")}</span>
      </label>
      {/* Announced, not just drawn: a sighted visitor reads the line, someone
          using a screen reader hears the result of their submit. */}
      <p
        id="footer-letter-status"
        role="status"
        aria-live="polite"
        className={`mt-2 font-sans text-[10px] leading-snug ${
          state === "invalid" || state === "failed"
            ? "text-rang-paper/85"
            : "text-haldi/90"
        }`}
      >
        {message ?? ""}
      </p>
    </form>
  );
}
