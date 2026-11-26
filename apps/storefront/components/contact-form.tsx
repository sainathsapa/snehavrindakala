"use client";

/**
 * Contact form.
 *
 * Works without JavaScript: it is a plain form that posts and redirects back
 * with `?contact=sent`. With JavaScript it posts to the same route and swaps in
 * the answer, which is faster and keeps the typed message on screen if the
 * server rejects it.
 *
 * The honeypot field is visible to a script and invisible to a person: it is
 * labelled "Website" and removed from the tab order, so a screen reader does not
 * stop on a field that must stay empty.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

type State = { status: "idle" | "sending" | "sent" | "error"; message?: string };

export function ContactForm() {
  const t = useTranslations("contact");
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({ status: "sending" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !payload.ok) {
        setState({ status: "error", message: payload.message });
        return;
      }
      setState({ status: "sent", message: payload.message });
      form.reset();
    } catch {
      setState({
        status: "error",
        message: "The message could not be sent. Please email hello@snehavrinda.in directly.",
      });
    }
  }

  const field =
    "w-full rounded-md border border-sand-border bg-white px-3 py-2.5 font-sans text-sm text-deep-ink placeholder:text-muted-ink/50 focus:border-sindoor focus:outline-none focus:ring-1 focus:ring-sindoor";
  const label = "grid gap-1.5 font-sans text-xs uppercase tracking-[0.14em] text-muted-ink";

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="mt-8 rounded-lg border border-leaf/30 bg-leaf/5 p-6"
      >
        <p className="font-serif text-lg text-deep-ink">{t("sentHeading")}</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
          {state.message || t("sentBody")}
        </p>
        <button
          type="button"
          onClick={() => setState({ status: "idle" })}
          className="mt-4 font-sans text-xs uppercase tracking-[0.16em] text-sindoor underline-offset-4 hover:underline"
        >
          {t("writeAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {t("nameLabel")}
          <input name="name" autoComplete="name" required maxLength={120} className={field} />
        </label>
        <label className={label}>
          {t("emailFieldLabel")}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={320}
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {t("phoneFieldLabel")}
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} className={field} />
        </label>
        <label className={label}>
          {t("orderLabel")}
          <input name="order" maxLength={40} placeholder="SVK-2026-00001" className={field} />
        </label>
      </div>

      <label className={label}>
        {t("subjectLabel")}
        <select name="subject" className={field} defaultValue="general">
          <option value="general">{t("subjectGeneral")}</option>
          <option value="order">{t("subjectOrder")}</option>
          <option value="commission">{t("subjectCommission")}</option>
          <option value="damage">{t("subjectDamage")}</option>
          <option value="press">{t("subjectPress")}</option>
        </select>
      </label>

      <label className={label}>
        {t("messageLabel")}
        <textarea
          name="message"
          required
          rows={7}
          maxLength={5000}
          minLength={10}
          className={`${field} resize-y`}
          placeholder={t("messagePlaceholder")}
        />
      </label>

      {/* Honeypot: off-screen, untabbable, never announced. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === "error" && (
        <p role="alert" className="font-sans text-sm text-terracotta">
          {state.message || t("errorBody")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state.status === "sending"}
          className="rounded-full bg-deep-ink px-6 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor disabled:opacity-60"
        >
          {state.status === "sending" ? t("sending") : t("submit")}
        </button>
        <p className="font-sans text-[11px] leading-relaxed text-muted-ink">
          {t("privacyNote")}
        </p>
      </div>
    </form>
  );
}
