"use server";

/**
 * Server actions for the checkout address.
 *
 * These replace `saveCheckoutDetailsAction`'s `redirect()`-based flow. The
 * redirect was the root cause of the worst checkout defect we had: a validation
 * failure navigated away, the route re-rendered from scratch, and every field the
 * customer had typed was gone. Here the action *returns* a result and the client
 * keeps its draft.
 *
 * What is preserved exactly as before:
 *   - the same Medusa cart update (`email`, `shipping_address`, `billing_address`)
 *   - the same country whitelist (`SHIPPING_COUNTRIES`)
 *   - the same requirement that an address is complete before it is stored
 *   - billing defaulting to the delivery address
 *
 * Validation is shared with the client (`lib/location/search`), so the browser
 * and the server cannot disagree about what a valid address is. The server pass
 * is not a courtesy — it is the one that counts.
 */

import { revalidatePath } from "next/cache";
import { getCart } from "@/lib/cart";
import { medusa } from "@/lib/medusa";
import { getAuthToken } from "@/lib/auth";
import { COUNTRY_CODES } from "@/lib/location/limits";
import { validateAddress, firstInvalidField, validateBilling, type AddressDraft, type BillingAddress, type BillingField } from "@/lib/location/search";

export interface AddressSaveResult {
  ok: boolean;
  error?: string;
  /** Field-level problems, so the form can highlight them precisely. */
  fields?: string[];
}

/** Split "Sneha Sapa" into Medusa's first/last pair without inventing a last name. */
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  const [first, ...rest] = parts;
  return {
    first_name: first || fullName.trim(),
    // Medusa's store API rejects an empty `last_name` on some versions, so the
    // family name falls back to the given name rather than to an empty string.
    last_name: rest.join(" ") || first || fullName.trim(),
  };
}

function toMedusaAddress(draft: AddressDraft) {
  return {
    ...splitName(draft.full_name),
    company: undefined,
    address_1: draft.address_1.trim(),
    address_2: draft.address_2.trim() || null,
    city: draft.city.trim(),
    province: draft.province.trim(),
    postal_code: draft.postal_code.trim(),
    country_code: draft.country_code.toLowerCase(),
    phone: draft.phone.trim() || null,
  };
}

/** The invoice party, which carries no phone number of its own. */
function toBillingAddress(billing: BillingAddress) {
  return {
    ...splitName(billing.full_name),
    company: undefined,
    address_1: billing.address_1.trim(),
    address_2: billing.address_2.trim() || null,
    city: billing.city.trim(),
    province: billing.province.trim(),
    postal_code: billing.postal_code.trim(),
    country_code: billing.country_code.toLowerCase(),
    phone: null,
  };
}

/**
 * Store the delivery address on the cart.
 *
 * Returns `{ ok: false, error }` instead of redirecting so the caller keeps the
 * customer's input.
 *
 * Billing defaults to the delivery address, which is what almost every order
 * wants and what Razorpay requires as a minimum. A buyer who needs a different
 * billing address — a company office, a gift, a registered business — can opt
 * into one; when they do, `billing` is validated separately and stored on its
 * own. It is never silently overwritten with the delivery address, because an
 * invoice made out to the wrong party is worse than one extra field.
 */
export async function saveCheckoutAddressAction(
  draft: AddressDraft,
  options: {
    saveToBook?: boolean;
    /** Present only when the buyer asked to bill somewhere else. */
    billing?: BillingAddress | null;
  } = {}
): Promise<AddressSaveResult> {
  const cart = await getCart();
  if (!cart) {
    return { ok: false, error: "Your cart has expired. Please add the artwork again." };
  }

  // Server-side validation, with the same rules the form used.
  const errors = validateAddress(draft);
  if (Object.keys(errors).length > 0) {
    const first = firstInvalidField(errors);
    return {
      ok: false,
      error: first ? errors[first] : "Please complete your delivery address.",
      fields: Object.keys(errors),
    };
  }

  const countryCode = draft.country_code.trim().toLowerCase();
  if (!COUNTRY_CODES.has(countryCode)) {
    return { ok: false, error: "We do not deliver to that country yet." };
  }

  // A billing address is optional, but one that was given must be complete.
  if (options.billing) {
    const billingErrors = validateBilling(options.billing);
    const firstBilling = (Object.keys(billingErrors) as BillingField[])[0];
    if (firstBilling) {
      return {
        ok: false,
        error: billingErrors[firstBilling],
        fields: [`billing_${firstBilling}`],
      };
    }
  }

  const email = draft.email.trim();
  const address = toMedusaAddress(draft);
  const billingAddress = options.billing
    ? toBillingAddress(options.billing)
    : address;

  try {
    await medusa.updateCart(cart.id, {
      email,
      shipping_address: address,
      billing_address: billingAddress,
    });
  } catch (error) {
    console.error("Failed to save checkout address", error);
    return {
      ok: false,
      error: "We could not save that address. Please try again in a moment.",
    };
  }

  // A signed-in buyer may have asked for the address to be remembered. This is
  // best-effort: the order must not fail because the address book write did.
  if (options.saveToBook) {
    const token = await getAuthToken().catch(() => null);
    if (token) {
      try {
        await medusa.createCustomerAddress(token, {
          ...address,
          is_default_shipping: false,
          is_default_billing: false,
        });
      } catch (error) {
        console.error("Could not add the address to the customer's book", error);
      }
    }
  }

  revalidatePath("/checkout");
  revalidatePath("/cart");
  return { ok: true };
}

/**
 * Save an address to the signed-in customer's book, without touching the cart.
 *
 * Separate from the cart update so "save for next time" can succeed or fail on
 * its own terms without blocking a purchase.
 */
export async function saveAddressToBookAction(
  draft: AddressDraft,
  makeDefault = false
): Promise<AddressSaveResult> {
  const token = await getAuthToken().catch(() => null);
  if (!token) {
    return { ok: false, error: "Sign in to save addresses to your account." };
  }

  const errors = validateAddress(draft);
  if (Object.keys(errors).length > 0) {
    const first = firstInvalidField(errors);
    return { ok: false, error: first ? errors[first] : "That address is incomplete." };
  }

  try {
    await medusa.createCustomerAddress(token, {
      ...toMedusaAddress(draft),
      is_default_shipping: makeDefault,
      is_default_billing: false,
    });
  } catch (error) {
    console.error("Could not save the address to the address book", error);
    return { ok: false, error: "We could not save that address to your account." };
  }

  revalidatePath("/account/addresses");
  return { ok: true };
}

/**
 * Use one of the customer's saved addresses for this cart.
 *
 * This is what lets a buyer switch address mid-checkout without restarting:
 * the cart is updated in place and the page refreshes its courier quotes.
 */
export async function useSavedAddressAction(
  addressId: string
): Promise<AddressSaveResult> {
  const [cart, token] = await Promise.all([
    getCart(),
    getAuthToken().catch(() => null),
  ]);

  if (!cart) {
    return { ok: false, error: "Your cart has expired. Please add the artwork again." };
  }
  if (!token) {
    return { ok: false, error: "Sign in to use a saved address." };
  }

  let addresses: any[] = [];
  try {
    addresses = await medusa.listCustomerAddresses(token);
  } catch {
    return { ok: false, error: "We could not load your saved addresses." };
  }

  // Never trust an id from the browser: it must belong to this customer.
  const match = addresses.find((entry) => entry.id === addressId);
  if (!match) {
    return { ok: false, error: "That address is no longer on your account." };
  }

  const address = {
    first_name: match.first_name,
    last_name: match.last_name,
    address_1: match.address_1,
    address_2: match.address_2 ?? null,
    company: match.company ?? null,
    city: match.city,
    province: match.province,
    postal_code: match.postal_code,
    country_code: match.country_code,
    phone: match.phone ?? null,
  };

  try {
    await medusa.updateCart(cart.id, {
      email: cart.email ?? undefined,
      shipping_address: address,
      billing_address: address,
    });
  } catch (error) {
    console.error("Failed to apply a saved address to the cart", error);
    return { ok: false, error: "We could not use that address. Please try another." };
  }

  revalidatePath("/checkout");
  return { ok: true };
}
