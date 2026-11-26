"use server";

import { getLocale } from "next-intl/server";
import { localeRedirect } from "@/lib/locale-redirect";
import { medusa } from "@/lib/medusa";
import { sendAccountEmail } from "@/lib/email/send";

/**
 * Step two of a password reset.
 *
 * The token in the form is Medusa's own reset token (mailed by the
 * `auth.password_reset` subscriber), not a session token, so it is used once
 * against `/auth/customer/emailpass/update` and then discarded. Medusa enforces
 * the expiry and single use; this action does not try to re-validate it, because
 * a second opinion in the storefront would be a second place to get it wrong.
 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") || "");
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  const locale = await getLocale();

  if (!token || !email) {
    localeRedirect("/account/forgot-password?error=invalid", locale);
  }
  if (password.length < 8) {
    localeRedirect(
      `/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&error=short`,
      locale
    );
  }
  if (password !== confirm) {
    localeRedirect(
      `/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&error=mismatch`,
      locale
    );
  }

  try {
    await medusa.updateCustomerPassword(token, email, password);
  } catch (error) {
    console.error("[reset-password] rejected", error);
    localeRedirect(
      `/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&error=expired`,
      locale
    );
  }

  // Tell the owner the password changed. This is the one email that must arrive
  // even though the customer is already signed out everywhere else.
  await sendAccountEmail({
    to: email,
    template: "password_changed",
    data: { changed_at: new Date().toISOString() },
    eventKey: `password_changed:${email}:${Date.now()}`,
  });

  localeRedirect("/account/login?reset=done", locale);
}
