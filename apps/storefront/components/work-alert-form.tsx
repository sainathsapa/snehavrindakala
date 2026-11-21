"use client";

/**
 * "Tell me when the next one arrives."
 *
 * Shown on a tradition's page rather than on sold-out products: every work is
 * one of one, so what a visitor can actually wait for is more work *like* this,
 * at a price they have in mind. The budget is optional and blank means "any".
 *
 * Needs no JavaScript — the form posts and redirects — and answers in place
 * when it can.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type State = "idle" | "sending" | "ok" | "exists" | "invalid" | "failed";

export function WorkAlertForm({
  artForm,
  artFormName,
}: {
  /** Tradition slug, so the alert is about this one and not everything. */
  artForm: string;
  artFormName: string;
}) {
  const t = useTranslations("workAlert");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    if (typeof fetch !== "function") return;
    event.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/store/work-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "fetch",
        },
        body: JSON.stringify({
          email,
          artForm,
          priceMax: priceMax || null,
          locale,
          consent: "on",
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setState(body?.reason === "invalid" ? "invalid" : "failed");
        return;
      }
      setState(body.reason === "already" ? "exists" : "ok");
      if (body.reason !== "already") {
        setEmail("");
        setPriceMax("");
      }
    } catch {
      setState("failed");
    }
  }

  const message =
    state === "ok"
      ? t("thanks", { name: artFormName })
      : state === "exists"
        ? t("already")
        : state === "invalid"
          ? t("invalid")
          : state === "failed"
            ? t("failed")
            : null;

  return (
    <form
      id="work-alert"
      action="/api/store/work-alerts"
      method="POST"
      onSubmit={submit}
      className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
    >
      <input type="hidden" name="artForm" value={artForm} />
      <input type="hidden" name="locale" value={locale} />
      <label className="grid gap-1.5">
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
          {t("emailLabel")}
        </span>
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          className="border-b border-sand-border bg-transparent py-2 font-sans text-sm text-ink placeholder:text-muted-ink/40 focus:border-terracotta focus:outline-none"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-ink/70">
          {t("budgetLabel")}
        </span>
        <select
          name="priceMax"
          value={priceMax}
          onChange={(event) => setPriceMax(event.target.value)}
          className="border-b border-sand-border bg-transparent py-2 font-sans text-sm text-ink focus:border-terracotta focus:outline-none"
        >
          <option value="">{t("anyBudget")}</option>
          <option value="10000">₹10,000</option>
          <option value="25000">₹25,000</option>
          <option value="50000">₹50,000</option>
          <option value="100000">₹1,00,000</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="border border-ink/20 px-4 py-2.5 font-sans text-[10px] uppercase tracking-[0.2em] text-ink transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-60"
      >
        {t("submit")}
      </button>
      <input type="hidden" name="consent" value="on" />
      <p
        role="status"
        aria-live="polite"
        className="font-sans text-xs leading-snug text-muted-ink sm:col-span-3"
      >
        {message ?? t("hint", { name: artFormName })}
      </p>
    </form>
  );
}
