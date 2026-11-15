import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { requireCustomer } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { getAuthToken } from "@/lib/auth";
import { SHIPPING_COUNTRIES } from "@/lib/currency";
import {
  deleteAddressAction,
  saveAddressAction,
} from "@/app/[locale]/account/address-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("addressesTitle") };
}

/**
 * The address book.
 *
 * Exists so a returning buyer does not retype a full delivery address on every
 * order — the single most avoidable piece of friction in a checkout. Addresses
 * are stored on the Medusa customer, so they follow the account across devices
 * rather than living in a cookie.
 *
 * Editing happens inline in the same form that creates: one component, one set
 * of validation rules, so an edit cannot drift from a create.
 */
export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const customer = await requireCustomer();
  const t = await getTranslations("account");
  const params = (await searchParams) ?? {};

  const token = await getAuthToken();
  let addresses: any[] = [];
  if (token) {
    try {
      addresses = await medusa.listCustomerAddresses(token);
    } catch {
      // A failed read must not hide the form; the buyer can still add one.
      addresses = [];
    }
  }

  // Which address, if any, is open for editing. `?edit=<id>` keeps this a
  // server-rendered page with no client state to get out of sync.
  const editId = typeof params.edit === "string" ? params.edit : "";
  const editing = addresses.find((address) => address.id === editId);

  const error = typeof params.error === "string" ? params.error : "";
  const field = typeof params.field === "string" ? params.field : "";

  const value = (key: string) =>
    editing ? String(editing[key] ?? "") : "";

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-sans text-sm font-medium uppercase tracking-wider text-sindoor">
              {t("addressesEyebrow")}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-deep-ink md:text-4xl">
              {t("addressesTitle")}
            </h1>
            <p className="mt-2 max-w-xl font-sans text-sm text-muted-ink">
              {t("addressesIntro")}
            </p>
          </div>
          <Link
            href="/account"
            className="shrink-0 font-sans text-sm text-muted-ink hover:text-sindoor"
          >
            ← {t("backToAccount")}
          </Link>
        </div>

        {error === "missing" && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-sindoor/40 bg-sindoor/5 px-4 py-3 font-sans text-sm text-sindoor"
          >
            {t("errorMissing", { field: field || "detail" })}
          </p>
        )}
        {error === "save" && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-sindoor/40 bg-sindoor/5 px-4 py-3 font-sans text-sm text-sindoor"
          >
            {t("errorSave")}
          </p>
        )}
        {params.saved && (
          <p
            role="status"
            className="mb-6 rounded-md border border-leaf/40 bg-leaf/5 px-4 py-3 font-sans text-sm text-leaf"
          >
            {t("addressSaved")}
          </p>
        )}
        {params.deleted && (
          <p
            role="status"
            className="mb-6 rounded-md border border-leaf/40 bg-leaf/5 px-4 py-3 font-sans text-sm text-leaf"
          >
            {t("addressDeleted")}
          </p>
        )}

        {/* ── Saved addresses ─────────────────────────────────────────── */}
        {addresses.length > 0 && (
          <ul className="mb-10 grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="flex flex-col justify-between rounded-lg border border-sand-border bg-surface/70 p-4"
              >
                <div className="font-sans text-sm leading-relaxed text-deep-ink">
                  <p className="font-medium">
                    {[address.first_name, address.last_name]
                      .filter(Boolean)
                      .join(" ")}
                    {address.is_default_shipping && (
                      <span className="ml-2 rounded-full bg-leaf/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-leaf">
                        {t("defaultAddress")}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-ink">
                    {address.address_1}
                    {address.address_2 ? `, ${address.address_2}` : ""}
                  </p>
                  <p className="text-muted-ink">
                    {[address.city, address.province, address.postal_code]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="text-muted-ink">
                    {COUNTRY_NAME(address.country_code)}
                  </p>
                  {address.phone && (
                    <p className="text-muted-ink">{address.phone}</p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-sand-border/70 pt-3">
                  <Link
                    href={`/account/addresses?edit=${address.id}`}
                    className="font-sans text-xs font-medium text-sindoor underline"
                  >
                    {t("editAddress")}
                  </Link>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <button
                      type="submit"
                      className="font-sans text-xs text-muted-ink underline hover:text-sindoor"
                    >
                      {t("deleteAddress")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── Add / edit ──────────────────────────────────────────────── */}
        <section
          id="address-form"
          className="rounded-lg border border-sand-border bg-surface/50 p-5"
        >
          <h2 className="font-serif text-xl font-semibold text-deep-ink">
            {editing ? t("editAddress") : t("addAddress")}
          </h2>

          <form action={saveAddressAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <Field label={t("firstName")} name="first_name" defaultValue={value("first_name")} required />
            <Field label={t("lastName")} name="last_name" defaultValue={value("last_name")} />
            <Field
              label={t("addressLine1")}
              name="address_1"
              defaultValue={value("address_1")}
              required
              className="sm:col-span-2"
            />
            <Field
              label={t("addressLine2")}
              name="address_2"
              defaultValue={value("address_2")}
              className="sm:col-span-2"
              optionalLabel={t("optional")}
            />
            <Field label={t("city")} name="city" defaultValue={value("city")} required />
            <Field label={t("state")} name="state" defaultValue={value("province")} />
            <Field
              label={t("postalCode")}
              name="postal_code"
              defaultValue={value("postal_code")}
              required
            />
            <Field label={t("phone")} name="phone" defaultValue={value("phone")} type="tel" />

            <label className="grid gap-1.5 font-sans text-sm sm:col-span-2">
              <span className="font-medium text-deep-ink">{t("country")}</span>
              <select
                name="country_code"
                defaultValue={editing?.country_code ?? "in"}
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                {SHIPPING_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 font-sans text-sm text-muted-ink sm:col-span-2">
              <input
                type="checkbox"
                name="is_default_shipping"
                defaultChecked={Boolean(editing?.is_default_shipping)}
                className="h-4 w-4 rounded border-sand-border text-sindoor focus:ring-sindoor"
              />
              {t("makeDefault")}
            </label>

            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-sindoor px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2"
              >
                {editing ? t("saveChanges") : t("saveAddress")}
              </button>
              {editing && (
                <Link
                  href="/account/addresses"
                  className="font-sans text-sm text-muted-ink underline"
                >
                  {t("cancel")}
                </Link>
              )}
            </div>
          </form>
        </section>

        <p className="mt-6 font-sans text-xs text-muted-ink">
          {t("addressesNote")}
        </p>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  className = "",
  optionalLabel,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  className?: string;
  optionalLabel?: string;
}) {
  return (
    <label className={`grid gap-1.5 font-sans text-sm ${className}`}>
      <span className="font-medium text-deep-ink">
        {label}
        {optionalLabel && (
          <span className="ml-1 text-xs font-normal text-muted-ink">
            ({optionalLabel})
          </span>
        )}
      </span>
      <input
        type={type}
        name={name}
        id={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
      />
    </label>
  );
}

/** Country display name from the shared shipping list. */
function COUNTRY_NAME(code: string | undefined): string {
  const match = SHIPPING_COUNTRIES.find(
    (country) => country.code === (code ?? "").toLowerCase()
  );
  return match?.name ?? String(code ?? "");
}
