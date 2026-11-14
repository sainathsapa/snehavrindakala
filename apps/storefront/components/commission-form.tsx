"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCommissionAction,
  type CommissionFormState,
} from "@/app/[locale]/custom-art/actions";

const initialState: CommissionFormState = {};

const ART_FORMS = [
  "Painting & drawing",
  "Traditional & folk art",
  "Home & décor",
  "Textile & fibre",
  "Paper & stationery",
  "Wearable art",
  "Other",
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-xs text-red-700 font-sans">
      {message}
    </p>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-60"
    >
      {pending ? "Sending your brief…" : "Submit request"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

export function CommissionForm() {
  const [state, formAction] = useActionState(
    createCommissionAction,
    initialState
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-sans"
        >
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="art_form"
          className="block text-sm font-medium text-deep-ink mb-1"
        >
          What kind of art? <span aria-hidden="true">*</span>
        </label>
        <select
          id="art_form"
          name="art_form"
          required
          aria-invalid={Boolean(errors.art_form)}
          aria-describedby={errors.art_form ? "art_form-error" : undefined}
          className={inputClass}
          defaultValue=""
        >
          <option value="">Select an art form</option>
          {ART_FORMS.map((form) => (
            <option key={form} value={form}>
              {form}
            </option>
          ))}
        </select>
        <FieldError id="art_form" message={errors.art_form} />
      </div>

      <div>
        <label
          htmlFor="brief"
          className="block text-sm font-medium text-deep-ink mb-1"
        >
          What do you have in mind? <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="brief"
          name="brief"
          rows={5}
          required
          aria-invalid={Boolean(errors.brief)}
          aria-describedby={errors.brief ? "brief-error" : "brief-hint"}
          className={inputClass}
          placeholder="Subject, mood, colours, who it is for, any reference you have in mind…"
        />
        {errors.brief ? (
          <FieldError id="brief" message={errors.brief} />
        ) : (
          <p id="brief-hint" className="mt-1 text-xs text-muted-ink font-sans">
            The more concrete the brief, the more accurate the quote.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="budget_range"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            Budget (₹)
          </label>
          <input
            id="budget_range"
            name="budget_range"
            type="text"
            className={inputClass}
            placeholder="e.g. 5,000 – 15,000"
          />
        </div>
        <div>
          <label
            htmlFor="target_date"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            Needed by
          </label>
          <input
            id="target_date"
            name="target_date"
            type="date"
            aria-invalid={Boolean(errors.target_date)}
            aria-describedby={
              errors.target_date ? "target_date-error" : undefined
            }
            className={inputClass}
          />
          <FieldError id="target_date" message={errors.target_date} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="dimensions"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            Size <span className="text-muted-ink font-normal">(optional)</span>
          </label>
          <input
            id="dimensions"
            name="dimensions"
            type="text"
            className={inputClass}
            placeholder="e.g. 60 × 90 cm"
          />
        </div>
        <div>
          <label
            htmlFor="delivery_pin"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            Delivery PIN <span className="text-muted-ink font-normal">(optional)</span>
          </label>
          <input
            id="delivery_pin"
            name="delivery_pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            aria-invalid={Boolean(errors.delivery_pin)}
            aria-describedby={
              errors.delivery_pin ? "delivery_pin-error" : undefined
            }
            className={inputClass}
            placeholder="560001"
          />
          <FieldError id="delivery_pin" message={errors.delivery_pin} />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-deep-ink mb-1"
        >
          Email for your quote
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="you@example.com"
        />
        <p className="mt-1 text-xs text-muted-ink font-sans">
          Leave this blank if you are signed in — we will use your account
          address.
        </p>
      </div>

      <div className="pt-4 border-t border-sand-border">
        <label className="flex items-start gap-3 cursor-pointer text-sm text-deep-ink font-sans">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="mt-1 text-sindoor focus:ring-sindoor"
            required
          />
          <span>
            I am happy for SnehaVrinda Kala to use anything I send for this
            commission. References stay private and are not shown publicly.{" "}
            <a href="/policies/privacy" className="text-sindoor underline">
              Privacy notice
            </a>
          </span>
        </label>
        <FieldError id="consent" message={errors.consent} />
      </div>

      <SubmitButton />

      <p className="text-xs text-muted-ink font-sans text-center">
        No payment now. You will get a quote with milestones to approve first.
      </p>
    </form>
  );
}
