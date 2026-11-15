"use server";

import { revalidatePath } from "next/cache";
import { localeRedirect } from "@/lib/locale-redirect";
import { getLocale } from "next-intl/server";
import { medusa } from "@/lib/medusa";
import { getAuthToken, getCurrentCustomer } from "@/lib/auth";
import { SHIPPING_COUNTRIES } from "@/lib/currency";

/**
 * Address book actions.
 *
 * Every one of these is a signed-in operation, so each re-checks the token
 * rather than trusting that the page rendered — a form can be posted after a
 * session expires, and an unauthenticated write would either 500 or, worse,
 * succeed against the wrong customer.
 */

const COUNTRY_CODES = new Set(SHIPPING_COUNTRIES.map((c) => c.code));

/** Medusa wants `country_code` lowercase; the form submits it as-is. */
function normaliseCountry(value: string): string {
  const code = value.trim().toLowerCase();
  return COUNTRY_CODES.has(code) ? code : "in";
}

function readAddress(formData: FormData) {
  const str = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    first_name: str("first_name"),
    last_name: str("last_name"),
    address_1: str("address_1"),
    address_2: str("address_2") || null,
    city: str("city"),
    province: str("state"),
    postal_code: str("postal_code"),
    country_code: normaliseCountry(str("country_code")),
    phone: str("phone") || null,
  };
}

/** The fields a usable delivery address cannot be missing. */
function missingFields(address: ReturnType<typeof readAddress>): string[] {
  const required: [keyof typeof address, string][] = [
    ["first_name", "first name"],
    ["address_1", "address"],
    ["city", "city"],
    ["postal_code", "postal code"],
  ];
  return required
    .filter(([key]) => !String(address[key] ?? "").trim())
    .map(([, label]) => label);
}

export async function saveAddressAction(formData: FormData): Promise<void> {
  const token = await getAuthToken();
  if (!token) localeRedirect("/account/login?next=/account/addresses", await getLocale());

  const address = readAddress(formData);
  const missing = missingFields(address);
  if (missing.length > 0) {
    // Name the first thing that is wrong rather than a generic failure: the
    // buyer can then fix it without guessing.
    localeRedirect(`/account/addresses?error=missing&field=${encodeURIComponent(missing[0])}`, await getLocale());
  }

  const id = String(formData.get("id") ?? "").trim();
  const flags = {
    is_default_shipping: formData.get("is_default_shipping") === "on",
    is_default_billing: formData.get("is_default_billing") === "on",
  };

  try {
    if (id) {
      await medusa.updateCustomerAddress(token, id, { ...address, ...flags });
    } else {
      await medusa.createCustomerAddress(token, { ...address, ...flags });
    }
  } catch (error) {
    console.error("Saving address failed", error);
    localeRedirect("/account/addresses?error=save", await getLocale());
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  localeRedirect("/account/addresses?saved=1", await getLocale());
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const token = await getAuthToken();
  if (!token) localeRedirect("/account/login?next=/account/addresses", await getLocale());

  const id = String(formData.get("id") ?? "").trim();
  if (id) {
    try {
      await medusa.deleteCustomerAddress(token, id);
    } catch (error) {
      console.error("Deleting address failed", error);
      localeRedirect("/account/addresses?error=delete", await getLocale());
    }
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  localeRedirect("/account/addresses?deleted=1", await getLocale());
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const token = await getAuthToken();
  if (!token) localeRedirect("/account/login", await getLocale());

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  try {
    await medusa.updateCustomer(token, {
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      phone: phone || undefined,
    });
  } catch (error) {
    console.error("Updating profile failed", error);
    localeRedirect("/account?error=profile", await getLocale());
  }

  revalidatePath("/account");
  localeRedirect("/account?saved=profile", await getLocale());
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const token = await getAuthToken();
  const customer = await getCurrentCustomer();
  if (!token || !customer?.email) localeRedirect("/account/login", await getLocale());

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current || !next) localeRedirect("/account?error=password#password", await getLocale());
  if (next.length < 8) localeRedirect("/account?error=password_short#password", await getLocale());
  if (next !== confirm) localeRedirect("/account?error=password_mismatch#password", await getLocale());

  try {
    // Verify the current password first. Without this, anyone holding a live
    // session — a shared laptop, an unlocked phone — could set a new password
    // and lock the real owner out. A successful login is the proof.
    await medusa.loginCustomer(customer.email, current);

    // Medusa will not change a password from a session token: the update route
    // requires a reset token, which only the account's mailbox can deliver.
    // So the honest flow is to send the reset mail, not to pretend we can skip
    // it. The customer lands on the reset link with proof of ownership.
    await medusa.requestPasswordReset(customer.email);
  } catch (error) {
    console.error("Changing password failed", error);
    localeRedirect("/account?error=password_wrong#password", await getLocale());
  }

  localeRedirect("/account?reset=sent", await getLocale());
}
