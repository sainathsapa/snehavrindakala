"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  createCommissionAction,
  type CommissionFormState,
} from "@/app/[locale]/custom-art/actions";

const initialState: CommissionFormState = {};

/**
 * The art-form choices are a stable list, so they are keyed rather than spelled
 * out here: the label comes from the message catalogue and the submitted value
 * stays the English one Medusa already stores.
 */
const ART_FORM_KEYS = [
  "painting",
  "folk",
  "home",
  "textile",
  "paper",
  "wearable",
  "other",
] as const;

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
  const t = useTranslations("commission");
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-60"
    >
      {pending ? t("sending") : t("submit")}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

interface UploadedRef {
  key: string;
  mime_type: string;
  size_bytes: number;
  original_filename?: string | null;
}

/**
 * Reference uploads.
 *
 * Files are sent to `/api/store/commission-upload` as soon as they are chosen,
 * so the buyer sees progress straight away and the brief submit stays fast. Only
 * the returned storage keys are carried into the form, as JSON in a hidden
 * field — the server stores files privately and never exposes a public URL.
 */
function ReferenceUpload({
  onChange,
}: {
  onChange: (refs: UploadedRef[]) => void;
}) {
  const t = useTranslations("commission");
  const [refs, setRefs] = useState<UploadedRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (next: UploadedRef[]) => {
    setRefs(next);
    onChange(next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const accepted: UploadedRef[] = [];
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        // Guard on the client too, so an obvious mistake is caught instantly.
        const okType = ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type);
        if (!okType) {
          setError("Please use a JPG, PNG, WebP image or a PDF.");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError("Each file must be 10 MB or smaller.");
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/store/commission-upload", {
          method: "POST",
          body: fd,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.key) {
          setError(body.error || "Upload failed. Please try again.");
          continue;
        }
        accepted.push({
          key: body.key,
          mime_type: body.mime_type,
          size_bytes: body.size_bytes,
          original_filename: body.original_filename,
        });
      }
      if (accepted.length > 0) {
        update([...refs, ...accepted].slice(0, 5));
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label htmlFor="references" className="block text-sm font-medium text-deep-ink mb-1">
        {t("references")}{" "}
        <span className="text-muted-ink font-normal">{t("sizeOptional")}</span>
      </label>
      <input
        id="references"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="block w-full cursor-pointer rounded-md border border-dashed border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink file:mr-3 file:rounded file:border-0 file:bg-sindoor file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-rang-paper hover:border-sindoor/60"
      />
      <p className="mt-1 text-xs text-muted-ink font-sans">{t("referencesHint")}</p>
      {busy && (
        <p className="mt-1 text-xs text-sindoor font-sans">{t("uploading")}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 font-sans">
          {error}
        </p>
      )}
      {refs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {refs.map((r, i) => (
            <li
              key={r.key}
              className="flex items-center justify-between rounded bg-rang-paper px-2 py-1 text-xs font-sans text-deep-ink"
            >
              <span className="truncate">
                {r.original_filename || `Reference ${i + 1}`}
              </span>
              <button
                type="button"
                onClick={() => update(refs.filter((x) => x.key !== r.key))}
                className="ml-2 text-muted-ink hover:text-kumkum"
                aria-label={`Remove ${r.original_filename || `reference ${i + 1}`}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CommissionForm() {
  const t = useTranslations("commission");
  const [state, formAction] = useActionState(
    createCommissionAction,
    initialState
  );
  const [attachments, setAttachments] = useState<UploadedRef[]>([]);
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
          {t("artFormLabel")} <span aria-hidden="true">*</span>
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
          <option value="">{t("artFormPlaceholder")}</option>
          {ART_FORM_KEYS.map((key) => (
            <option key={key} value={t(`artForms.${key}`)}>
              {t(`artForms.${key}`)}
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
          {t("briefLabel")} <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="brief"
          name="brief"
          rows={5}
          required
          aria-invalid={Boolean(errors.brief)}
          aria-describedby={errors.brief ? "brief-error" : "brief-hint"}
          className={inputClass}
          placeholder={t("briefPlaceholder")}
        />
        {errors.brief ? (
          <FieldError id="brief" message={errors.brief} />
        ) : (
          <p id="brief-hint" className="mt-1 text-xs text-muted-ink font-sans">
            {t("briefHint")}
          </p>
        )}
      </div>

      <ReferenceUpload onChange={setAttachments} />
      <input
        type="hidden"
        name="attachments"
        value={JSON.stringify(attachments)}
      />

      <div>
        <label
          htmlFor="intended_use"
          className="block text-sm font-medium text-deep-ink mb-1"
        >
          {t("intendedUse")}{" "}
          <span className="text-muted-ink font-normal">{t("sizeOptional")}</span>
        </label>
        <select
          id="intended_use"
          name="intended_use"
          className={inputClass}
          defaultValue=""
        >
          <option value="">{t("intendedUsePlaceholder")}</option>
          <option value="A gift">{t("use.gift")}</option>
          <option value="Home décor">{t("use.home")}</option>
          <option value="A wedding or ceremony">{t("use.wedding")}</option>
          <option value="A corporate or office space">{t("use.corporate")}</option>
          <option value="A personal keepsake">{t("use.keepsake")}</option>
          <option value="Other">{t("use.other")}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="budget_range"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            {t("budget")}
          </label>
          <input
            id="budget_range"
            name="budget_range"
            type="text"
            className={inputClass}
            placeholder={t("budgetPlaceholder")}
          />
        </div>
        <div>
          <label
            htmlFor="target_date"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            {t("neededBy")}
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
            {t("size")} <span className="text-muted-ink font-normal">{t("sizeOptional")}</span>
          </label>
          <input
            id="dimensions"
            name="dimensions"
            type="text"
            className={inputClass}
            placeholder={t("sizePlaceholder")}
          />
        </div>
        <div>
          <label
            htmlFor="delivery_pin"
            className="block text-sm font-medium text-deep-ink mb-1"
          >
            {t("pin")} <span className="text-muted-ink font-normal">{t("sizeOptional")}</span>
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
            placeholder={t("pinPlaceholder")}
          />
          <FieldError id="delivery_pin" message={errors.delivery_pin} />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-deep-ink mb-1"
        >
          {t("email")}
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
          {t("emailHint")}
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
            {t("consent")}{" "}
            <a href="/policies/privacy" className="text-sindoor underline">
              {t("privacy")}
            </a>
          </span>
        </label>
        <FieldError id="consent" message={errors.consent} />
      </div>

      <SubmitButton />

      <p className="text-xs text-muted-ink font-sans text-center">
        {t("noPayment")}
      </p>
    </form>
  );
}
