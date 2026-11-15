"use client";

/**
 * The delivery-address form.
 *
 * Everything the customer types lives in React state here, which is the point.
 * The previous form was a server-rendered `<form action={…}>`: any validation
 * failure `redirect()`ed back to `/checkout?error=missing`, and because the page
 * re-rendered from scratch, every field the customer had filled was gone. That
 * single behaviour is why address entry felt punishing.
 *
 * Now:
 *   - the draft is local state; validation failures never unmount it
 *   - the draft is mirrored to sessionStorage so a refresh or a round trip
 *     through Razorpay does not lose it either
 *   - country → state → city are searchable comboboxes whose options narrow with
 *     each other (a city list that depends on the state is what stops a courier
 *     label reading "Jaipur, Kerala")
 *   - the postal code *suggests* a state and city but never overwrites a value
 *     the buyer set themselves, and unsupported countries simply skip it
 *
 * The field order is the order an address is read aloud and written on an
 * envelope: who, how to reach them, where they live (country → PIN → state →
 * city → street), then the detail that helps the courier. The PIN comes before
 * state and city because in India and the US it *implies* them, so it does the
 * work and the buyer confirms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Combobox } from "./combobox";
import {
  COUNTRIES,
  citiesFor,
  countryByCode,
  postalInputMode,
  postalMaxLength,
  regionsFor,
  suggestRegion,
} from "@/lib/location";
import {
  EMPTY_ADDRESS,
  composePhone,
  firstInvalidField,
  localPhoneDigits,
  validateAddress,
  validatePhone,
  validatePostal,
  type AddressDraft,
  type AddressField,
} from "@/lib/location/search";

export interface SavedAddress {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country_code: string;
  postal_code: string;
  province: string;
  city: string;
  address_1: string;
  address_2: string;
  is_default: boolean;
}

export interface AddressFormProps {
  /** The address to start from — a saved address, a prefilled cart, or blank. */
  initial: Partial<AddressDraft> | null;
  /** Saved addresses the buyer can switch to. Empty for guests. */
  saved?: SavedAddress[];
  /** The saved address currently in use, if any. */
  selectedId?: string | null;
  /** Called with the validated draft; the parent decides what to do with it. */
  onSubmit: (draft: AddressDraft, options: { saveToBook: boolean }) => Promise<void> | void;
  /** Called when the buyer picks a different saved address. */
  onSelectSaved?: (address: SavedAddress) => void;
  /** Called to enter editing for a saved address. */
  onEditSaved?: (address: SavedAddress) => void;
  /** Called when a new address should be added to the account book. */
  onSaveToBook?: (draft: AddressDraft, makeDefault: boolean) => Promise<void>;
  submitting?: boolean;
  /** Server-side error, shown above the submit button. */
  submitError?: string | null;
  /** Copy for the primary button. */
  submitLabel: string;
  /** Shown under the button, explaining what happens next. */
  submitHint?: string;
  /** Whether the buyer is signed in (controls "save to my addresses"). */
  canSaveToAccount?: boolean;
  /** Restores focus after a failed submit. */
  focusField?: AddressField | null;
  /** Hides the email field where the address book supplies it. */
  lockedEmail?: string | null;
}

const DRAFT_KEY = "svk:checkout-address-draft";
const BOOK_KEY = "svk:checkout-saved-addresses";

/** Which fields carry an error; individual fields validate on blur. */
type ErrorMap = Partial<Record<AddressField, string>>;

function readDraft(): Partial<AddressDraft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<AddressDraft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: AddressDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked — the in-memory draft still works.
  }
}

export function AddressForm({
  initial,
  saved = [],
  selectedId = null,
  onSubmit,
  onSelectSaved,
  onEditSaved,
  onSaveToBook,
  submitting = false,
  submitError = null,
  submitLabel,
  submitHint,
  canSaveToAccount = false,
  focusField = null,
  lockedEmail = null,
}: AddressFormProps) {
  const t = useTranslations("checkout");
  const [draft, setDraft] = useState<AddressDraft>(() => {
    // A half-typed draft beats a prefill: the buyer typed it seconds ago.
    const restored = readDraft();
    const start = restored ?? initial ?? EMPTY_ADDRESS;
    return { ...EMPTY_ADDRESS, ...start };
  });

  const [errors, setErrors] = useState<ErrorMap>({});
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({});
  const [saveToBook, setSaveToBook] = useState(false);
  const [makeDefault, setMakeDefault] = useState(saved.length === 0);
  const [suggesting, setSuggesting] = useState(false);  /**
   * State/city the buyer has not personally edited. The suggestion may replace
   * those, and only those — the rule that keeps a lookup from silently
   * overwriting something a human typed.
   */
  const [autoFilled, setAutoFilled] = useState<{ province: boolean; city: boolean }>({
    province: false,
    city: false,
  });
  const [usingSaved, setUsingSaved] = useState<string | null>(selectedId);
  const [editingSaved, setEditingSaved] = useState<string | null>(null);

  const refs = useRef<Partial<Record<AddressField, HTMLInputElement | null>>>({});

  const country = countryByCode(draft.country_code);
  const states = useMemo(() => regionsFor(draft.country_code), [draft.country_code]);
  const cities = useMemo(
    () => citiesFor(draft.country_code, draft.province),
    [draft.country_code, draft.province]
  );

  const canSearchStates = Boolean(country?.hasRegions) && states.length > 0;
  const canSearchCities = cities.length > 0;

  const set = useCallback(<K extends AddressField>(field: K, value: AddressDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  // Persist as they type so a refresh cannot cost them the form.
  useEffect(() => {
    writeDraft(draft);
    try {
      sessionStorage.setItem(BOOK_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [draft, saved]);

  // Clear the stored draft once an address is actually accepted, otherwise the
  // next order would prefill with an old one.
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Changing country invalidates state and city — they belong to the old one.
  const changeCountry = useCallback(
    (code: string) => {
      const matched = COUNTRIES.find(
        (entry) => entry.name === code || entry.code === code
      );
      const nextCode = matched?.code ?? "";
      if (nextCode === draft.country_code) return;

      setDraft((current) => ({
        ...current,
        country_code: nextCode,
        province: "",
        city: "",
        // A PIN from another country is meaningless here.
        postal_code: matched?.code === current.country_code ? current.postal_code : "",
      }));
      setAutoFilled({ province: false, city: false });
      setErrors((current) => ({ ...current, country_code: undefined, province: undefined, city: undefined }));
    },
    [draft.country_code]
  );

  const changeState = useCallback((state: string) => {
    setDraft((current) => ({
      ...current,
      province: state,
      // A city that existed in the previous state is now wrong.
      city: citiesFor(current.country_code, state).includes(current.city) ? current.city : "",
    }));
    setAutoFilled({ province: false, city: false });
  }, []);

  /**
   * Suggest state (and, where we have a list, city) from the postal code.
   *
   * Runs on blur rather than on every keystroke: a lookup per digit would fire
   * for impossible prefixes and flicker the form. Any state the buyer chose
   * themselves is left alone, and the city is only suggested when it is empty.
   */
  const suggestFromPostal = useCallback(
    (postal: string) => {
      const region = suggestRegion(draft.country_code, postal);
      if (!region) return;

      const regionDiffers = draft.province.trim() && draft.province !== region;
      // Do not fight a deliberate choice.
      if (draft.province.trim() && !autoFilled.province) return;

      const nextCities = citiesFor(draft.country_code, region);
      setDraft((current) => ({
        ...current,
        province: autoFilled.province || !current.province.trim() ? region : current.province,
        // City: only fill a list we actually have, and only into an empty field.
        city:
          nextCities.length === 1
            ? nextCities[0]
            : current.city.trim() && !autoFilled.city
              ? current.city
              : current.city,
      }));
      setAutoFilled((current) => ({
        province: current.province || !regionDiffers,
        city: current.city,
      }));
    },
    [draft.country_code, draft.province, autoFilled]
  );

  const blurField = (field: AddressField) => {
    setTouched((current) => ({ ...current, [field]: true }));

    const message = fieldError(field);
    setErrors((current) => ({ ...current, [field]: message ?? undefined }));
  };

  /** One field's message, using the same rules as the submit-time pass. */
  function fieldError(field: AddressField): string | null {
    switch (field) {
      case "full_name":
        if (!draft.full_name.trim()) return "Enter the name the courier should ask for.";
        if (draft.full_name.trim().length < 2) return "That name looks too short.";
        return null;
      case "email":
        if (!lockedEmail && !draft.email.trim()) return "We send the order confirmation here.";
        if (!lockedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim()))
          return "That email address is missing something.";
        return null;
      case "phone":
        return validatePhone(draft.phone);
      case "country_code":
        return countryByCode(draft.country_code) ? null : "Choose a country we deliver to.";
      case "postal_code":
        return validatePostal(draft.postal_code, draft.country_code);
      case "province":
        return draft.province.trim() ? null : "Choose your state or region.";
      case "city":
        return draft.city.trim() ? null : "Choose or type your city.";
      case "address_1":
        if (!draft.address_1.trim()) return "Enter your street address.";
        if (draft.address_1.trim().length < 5)
          return "Add the house or building number and the street.";
        return null;
      default:
        return null;
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validateAddress({
      ...draft,
      email: lockedEmail ?? draft.email,
    });
    setErrors(nextErrors);
    setTouched(
      (["full_name", "email", "phone", "address_1", "country_code", "postal_code", "province", "city"] as AddressField[])
        .reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    const firstInvalid = firstInvalidField(nextErrors);
    if (firstInvalid) {
      refs.current[firstInvalid]?.focus();
      return;
    }

    setSuggesting(true);
    try {
      await onSubmit({ ...draft, email: lockedEmail ?? draft.email }, { saveToBook });
      clearDraft();
    } finally {
      setSuggesting(false);
    }
  };

  // Focus a field the parent asked for (a failed server-side submit).
  useEffect(() => {
    if (!focusField) return;
    refs.current[focusField]?.focus();
  }, [focusField]);

  const busy = submitting || suggesting;

  /*
   * When a saved address is selected, the form collapses to a summary with an
   * explicit Edit action. That is the whole "don't make me retype it" story:
   * the common case is one line of confirmation plus a Pay button, and the long
   * form only appears when something actually needs to change.
   */
  const selectedSaved = saved.find((entry) => entry.id === usingSaved) ?? null;
  const showSummary = Boolean(selectedSaved) && editingSaved !== selectedSaved?.id;

  if (showSummary && selectedSaved) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-sand-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="font-sans text-sm leading-relaxed text-deep-ink">
              <p className="font-medium">
                {selectedSaved.full_name}
                {selectedSaved.is_default && (
                  <span className="ml-2 rounded-full bg-leaf/10 px-2 py-0.5 align-middle font-sans text-[10px] font-semibold uppercase tracking-wider text-leaf">
                    Default
                  </span>
                )}
              </p>
              <p className="text-muted-ink">
                {[selectedSaved.address_1, selectedSaved.address_2].filter(Boolean).join(", ")}
              </p>
              <p className="text-muted-ink">
                {[selectedSaved.city, selectedSaved.province, selectedSaved.postal_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="text-muted-ink">
                {countryByCode(selectedSaved.country_code)?.name ?? selectedSaved.country_code}
              </p>
              {selectedSaved.phone && (
                <p className="mt-1 text-muted-ink">{selectedSaved.phone}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSaved(selectedSaved.id);
                onEditSaved?.(selectedSaved);
                setDraft({ ...EMPTY_ADDRESS, ...selectedSaved });
              }}
              className="shrink-0 rounded-full border border-sand-border px-3 py-1 font-sans text-xs font-medium text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
            >
              {t("formEdit")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {saved.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setUsingSaved(null);
                setDraft({ ...EMPTY_ADDRESS });
                setEditingSaved(null);
              }}
              className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
            >
              {t("formUseDifferent")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setUsingSaved(null);
              setEditingSaved(null);
              setDraft({ ...EMPTY_ADDRESS, full_name: selectedSaved.full_name, email: selectedSaved.email, phone: selectedSaved.phone });
            }}
            className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
          >
            Add a new address
          </button>
        </div>

        {submitError && (
          <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          onClick={async () => {
            setSuggesting(true);
            try {
              await onSubmit(
                { ...EMPTY_ADDRESS, ...selectedSaved },
                { saveToBook: false }
              );
            } finally {
              setSuggesting(false);
            }
          }}
          disabled={busy}
          className="w-full rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-semibold text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? t("savingAddress") : submitLabel}
        </button>
        {submitHint && (
          <p className="text-center font-sans text-xs text-muted-ink">{submitHint}</p>
        )}
      </div>
    );
  }

  const dialCode = country?.dialCode ?? "";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Saved addresses, as a quiet row above the form — picking one is one tap,
          and it beats scrolling a long form. */}
      {saved.length > 0 && (
        <div className="space-y-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
            {t("formSavedAddresses")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {saved.map((entry, index) => {
              const active = entry.id === usingSaved;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setUsingSaved(entry.id);
                    setEditingSaved(null);
                    onSelectSaved?.(entry);
                    setDraft({ ...EMPTY_ADDRESS, ...entry });
                    setErrors({});
                  }}
                  aria-pressed={active}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-sindoor bg-sindoor/5"
                      : "border-sand-border hover:border-sindoor/50"
                  }`}
                >
                  <span className="flex items-center gap-2 font-sans text-[13px] font-medium text-deep-ink">
                    {entry.full_name}
                    {entry.is_default && (
                      <span className="rounded-full bg-leaf/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-leaf">
                        Default
                      </span>
                    )}
                    {index === 0 && !entry.is_default && saved.length > 1 && (
                      <span className="text-[9px] font-normal uppercase tracking-wider text-muted-ink">
                        {t("formRecent")}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate font-sans text-xs text-muted-ink">
                    {[entry.address_1, entry.city, entry.postal_code].filter(Boolean).join(", ")}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setUsingSaved(null);
              setEditingSaved(null);
              setDraft({ ...EMPTY_ADDRESS });
              setSuggesting(false);
            }}
            className="font-sans text-xs font-medium text-terracotta underline-offset-4 hover:underline"
          >
            {t("formAddNew")}
          </button>
        </div>
      )}

      {/* ── Who ─────────────────────────────────────────────────────── */}
      <Field
        label={t("formFullName")}
        value={draft.full_name}
        onChange={(value) => set("full_name", value)}
        onBlur={() => blurField("full_name")}
        error={touched.full_name ? errors.full_name : undefined}
        autoComplete="name"
        inputRef={(node) => {
          refs.current.full_name = node;
        }}
        required
        autoCapitalize="words"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("formEmail")}
          type="email"
          value={lockedEmail ?? draft.email}
          onChange={(value) => set("email", value)}
          onBlur={() => blurField("email")}
          error={touched.email ? errors.email : undefined}
          autoComplete="email"
          inputMode="email"
          disabled={Boolean(lockedEmail)}
          inputRef={(node) => {
            refs.current.email = node;
          }}
          required
        />

        <Field
          label={t("formPhone")}
          type="tel"
          value={draft.phone}
          onChange={(value) => set("phone", value)}
          onBlur={() => {
            // Store the number with its calling code so Razorpay and the courier
            // both get something they can dial.
            set("phone", composePhone(draft.phone, dialCode));
            blurField("phone");
          }}
          error={touched.phone ? errors.phone : undefined}
          autoComplete="tel-national"
          inputMode="tel"
          prefix={dialCode ? `+${dialCode}` : undefined}
          hint={t("formPhoneHint")}
          inputRef={(node) => {
            refs.current.phone = node;
          }}
          required
        />
      </div>

      {/* ── Where ───────────────────────────────────────────────────── */}
      <Combobox
        label={t("formCountry")}
        value={country?.name ?? ""}
        onValueChange={changeCountry}
        options={COUNTRIES.map((entry) => entry.name)}
        placeholder={t("formSearchCountries")}
        error={touched.country_code ? errors.country_code : undefined}
        autoComplete="country-name"
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={country?.postalLabel ?? "Postal code"}
          value={draft.postal_code}
          onChange={(value) => set("postal_code", value)}
          onBlur={() => {
            blurField("postal_code");
            suggestFromPostal(draft.postal_code);
          }}
          error={touched.postal_code ? errors.postal_code : undefined}
          autoComplete="postal-code"
          inputMode={postalInputMode(draft.country_code)}
          maxLength={postalMaxLength(draft.country_code)}
          placeholder={country?.postalExample || undefined}
          disabled={!draft.country_code}
          hint={
            draft.country_code === "in" || draft.country_code === "us"
              ? "We fill in your state from this."
              : undefined
          }
          inputRef={(node) => {
            refs.current.postal_code = node;
          }}
          required
        />

        {canSearchStates ? (
          <Combobox
            label={country?.code === "in" ? t("formState") : t("formStateRegion")}
            value={draft.province}
            onValueChange={changeState}
            onInputChange={(text) => set("province", text)}
            options={states}
            placeholder={t("formSearchStates")}
            error={touched.province ? errors.province : undefined}
            autoComplete="address-level1"
            disabled={!draft.country_code}
            required
            emptyMessage={t("formNoStateMatch")}
          />
        ) : (
          <Field
            label={country?.code === "in" ? t("formState") : t("formStateRegion")}
            value={draft.province}
            onChange={(value) => set("province", value)}
            onBlur={() => blurField("province")}
            error={touched.province ? errors.province : undefined}
            autoComplete="address-level1"
            disabled={!draft.country_code}
            hint={draft.country_code && !country?.hasRegions ? t("formNoRegions") : undefined}
            inputRef={(node) => {
              refs.current.province = node;
            }}
            required
          />
        )}
      </div>

      {canSearchCities ? (
        <Combobox
          label={t("formCity")}
          value={draft.city}
          onValueChange={(value) => set("city", value)}
          onInputChange={(text) => set("city", text)}
          options={cities}
          placeholder={t("formSearchCities")}
          allowFreeText
          error={touched.city ? errors.city : undefined}
          autoComplete="address-level2"
          disabled={!draft.province}
          hint={!draft.province ? t("formChooseStateFirst") : t("formCityNotListed")}
          required
        />
      ) : (
        <Field
          label={t("formCity")}
          value={draft.city}
          onChange={(value) => set("city", value)}
          onBlur={() => blurField("city")}
          error={touched.city ? errors.city : undefined}
          autoComplete="address-level2"
          disabled={!draft.country_code}
          inputRef={(node) => {
            refs.current.city = node;
          }}
          required
        />
      )}

      <Field
        label={t("formStreet")}
        value={draft.address_1}
        onChange={(value) => set("address_1", value)}
        onBlur={() => blurField("address_1")}
        error={touched.address_1 ? errors.address_1 : undefined}
        autoComplete="address-line1"
        placeholder={t("formStreetPlaceholder")}
        inputRef={(node) => {
          refs.current.address_1 = node;
        }}
        required
        multiline
      />

      <Field
        label={t("formLine2")}
        value={draft.address_2}
        onChange={(value) => set("address_2", value)}
        autoComplete="address-line2"
        placeholder={t("formLine2Placeholder")}
        inputRef={(node) => {
          refs.current.address_2 = node;
        }}
      />

      {canSaveToAccount && onSaveToBook && (
        <div className="space-y-2 rounded-md border border-sand-border/80 bg-rang-paper/40 p-3">
          <label className="flex cursor-pointer items-start gap-2 font-sans text-sm text-deep-ink">
            <input
              type="checkbox"
              checked={saveToBook}
              onChange={(event) => setSaveToBook(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-sand-border accent-sindoor"
            />
            {t("formSaveToBook")}
          </label>
          {saveToBook && saved.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 pl-6 font-sans text-xs text-muted-ink">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(event) => setMakeDefault(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-sand-border accent-sindoor"
              />
              {t("formMakeDefault")}
            </label>
          )}
        </div>
      )}

      {submitError && (
        <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-kumkum px-6 py-3.5 font-sans text-sm font-semibold text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {busy ? t("savingAddress") : submitLabel}
      </button>

      {submitHint && (
        <p className="text-center font-sans text-xs text-muted-ink">{submitHint}</p>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  prefix,
  required = false,
  disabled = false,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
  multiline = false,
  autoCapitalize,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  prefix?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: "words" | "off";
  inputRef?: (node: HTMLInputElement | null) => void;
}) {
  const t = useTranslations("checkout");
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const shared = {
    id,
    name: id,
    value,
    required,
    disabled,
    maxLength,
    placeholder,
    autoComplete,
    inputMode,
    autoCapitalize,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    onBlur,
    className:
      "w-full rounded-md border bg-surface px-3 py-2.5 font-sans text-base text-deep-ink placeholder:text-muted-ink/60 transition-colors focus:outline-none focus:ring-2 sm:text-sm " +
      (error
        ? "border-sindoor focus:ring-sindoor/40"
        : "border-sand-border focus:border-sindoor/60 focus:ring-sindoor/25"),
  };

  return (
    <div className={multiline ? "" : "min-w-0"}>
      <label htmlFor={id} className="mb-1.5 block font-sans text-[13px] font-medium text-deep-ink">
        {label}
        {!required && <span className="ml-1 font-normal text-muted-ink">({t("formOptional")})</span>}
      </label>

      {prefix ? (
        <div className="flex items-stretch rounded-md border border-sand-border bg-surface focus-within:border-sindoor/60 focus-within:ring-2 focus-within:ring-sindoor/25">
          <span className="flex shrink-0 items-center border-r border-sand-border/70 px-3 font-sans text-sm text-muted-ink">
            {prefix}
          </span>
          <input
            {...shared}
            ref={inputRef}
            type={type}
            className="w-full rounded-md bg-transparent px-3 py-2.5 font-sans text-base text-deep-ink placeholder:text-muted-ink/60 focus:outline-none sm:text-sm"
          />
        </div>
      ) : multiline ? (
        <textarea
          {...(shared as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={2}
          ref={(node) => inputRef?.(node as unknown as HTMLInputElement | null)}
          className={shared.className + " resize-none"}
        />
      ) : (
        <input {...shared} ref={inputRef} type={type} />
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 font-sans text-xs text-sindoor">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 font-sans text-xs text-muted-ink">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { localPhoneDigits };
