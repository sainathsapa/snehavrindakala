/**
 * Guest → account, at the moment an order is paid.
 *
 * Most buyers here never visit a signup form: they order once, as a guest, and
 * are left with an order they cannot look up and nothing to sign back in with.
 * So the account is created for them and they get one email containing the order
 * details, the invoice PDF, a temporary password, and a one-click way to choose
 * their own password instead.
 *
 * Two rules it will not break:
 *
 *  1. **It never fails an order.** This runs after payment succeeded. Every
 *     error is logged and swallowed.
 *  2. **It is idempotent.** An existing customer is left alone, and a retried
 *     completion does not create a second account or a second email.
 *
 * On the temporary password: it is generated here, used once to create the
 * identity, and mailed only because the owner asked for a working credential.
 * The email tells the customer to replace it, and also carries the single-use
 * set-password link, which is the path we would prefer them to take.
 */

import { randomBytes, randomInt } from "crypto";
import { medusa } from "@/lib/medusa";
import { sendAccountEmail } from "@/lib/email/send";
import { buildInvoicePdf, invoiceFileName } from "@/lib/invoice-pdf";
import { invoiceFactsFromOrder, type OrderLikeForInvoice } from "@/lib/invoice";

export type GuestAccountOutcome =
  | "created"
  | "existing"
  | "skipped_no_email"
  | "skipped_signed_in"
  | "failed";

export interface GuestAccountResult {
  outcome: GuestAccountOutcome;
  /**
   * The temporary password, returned ONLY when this call created the account.
   * The route uses it to sign the buyer in immediately; it is otherwise never
   * read, stored or logged, and it is never included in any log line.
   */
  password?: string;
}

/** Avoids o/0 and l/1: this password gets read off a phone screen. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function temporaryPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CompleteOrder extends OrderLikeForInvoice {
  customer_id?: string | null;
  shipping_address?: any;
}

export async function ensureAccountForGuestOrder(
  order: CompleteOrder,
  opts: { signedIn?: boolean } = {}
): Promise<GuestAccountResult> {
  const email = String(order?.email || "").trim();

  if (opts.signedIn || order?.customer_id) {
    return { outcome: "skipped_signed_in" };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { outcome: "skipped_no_email" };
  }

  const password = temporaryPassword();
  const firstName = order.shipping_address?.first_name || undefined;
  const lastName = order.shipping_address?.last_name || undefined;
  const phone = order.shipping_address?.phone || undefined;

  // Build the invoice first: if the PDF cannot be produced we still want the
  // account email to go out, just without the attachment.
  let attachment: { filename: string; content: string; contentType: string } | null = null;
  try {
    const facts = invoiceFactsFromOrder(order);
    const pdf = buildInvoicePdf(facts);
    attachment = {
      filename: invoiceFileName(facts.invoiceNumber),
      content: pdf.toString("base64"),
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("[guest-account] invoice PDF could not be built", err);
  }

  try {
    const auth = await medusa.registerCustomer(email, password);

    try {
      await medusa.createCustomer(auth.token, {
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(phone ? { phone } : {}),
      });
    } catch (err) {
      // A half-created account is worse than none: an identity with no profile
      // means a sign-in that leads nowhere.
      console.error("[guest-account] profile creation failed", err);
      return { outcome: "failed" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/exist|already|duplicate/i.test(message)) return { outcome: "existing" };
    console.error("[guest-account] could not create the account", message);
    return { outcome: "failed" };
  }

  const orderForEmail = {
    display_id: order.display_id ?? null,
    id: order.id ?? null,
    total: order.total ?? 0,
    subtotal: order.subtotal ?? 0,
    shipping_total: order.shipping_total ?? 0,
    discount_total: order.discount_total ?? 0,
    currency_code: order.currency_code ?? "inr",
    shipping_address: order.shipping_address ?? null,
    items: (order.items || []).map((item) => ({
      title: item.product_title || item.title,
      variant_title: item.variant_title,
      quantity: item.quantity,
      total: item.total ?? (item.unit_price ?? 0) * (item.quantity ?? 1),
    })),
  };

  await sendAccountEmail({
    to: email,
    template: "account_created",
    eventKey: `account_created:${email}`,
    data: {
      temp_password: password,
      email,
      expires_in_minutes: 60,
      order_reference: order.display_id ?? order.id ?? null,
      order: orderForEmail,
    },
    ...(attachment ? { attachments: [attachment] } : {}),
  });

  console.log(`[guest-account] account + invoice emailed for order ${order?.id ?? "?"}`);
  return { outcome: "created", password };
}
