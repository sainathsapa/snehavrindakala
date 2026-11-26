"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { localeRedirect } from "@/lib/locale-redirect";
import { getLocale } from "next-intl/server";
import { medusa } from "@/lib/medusa";
import { AUTH_COOKIE } from "@/lib/auth";
import { claimCartForCustomer } from "@/lib/cart";
import { describeClient, sendAccountEmail } from "@/lib/email/send";

/** User agent of the request currently being handled, for the sign-in alert. */
async function currentUserAgent(): Promise<string | null> {
  try {
    return (await headers()).get("user-agent");
  } catch {
    return null;
  }
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    localeRedirect("/account/login?error=missing", await getLocale());
  }

  let token: string;
  try {
    const result = await medusa.loginCustomer(email, password);
    token = result.token;
  } catch (error) {
    console.error("Login failed", error);
    localeRedirect("/account/login?error=invalid", await getLocale());
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  // Give the basket to the account so it follows them to another device.
  await claimCartForCustomer(token);

  // New device, new session: tell the owner. Sent after the cookie is set and
  // awaited so a serverless freeze cannot drop it, but it never blocks sign-in.
  await sendAccountEmail({
    to: email,
    template: "login_alert",
    data: {
      signed_in_at: new Date().toISOString(),
      device: describeClient(await currentUserAgent()),
    },
    eventKey: `login_alert:${email}:${new Date().toISOString().slice(0, 10)}`,
  });

  localeRedirect("/account", await getLocale());
}

export async function registerAction(formData: FormData): Promise<void> {
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    localeRedirect("/account/register?error=missing", await getLocale());
  }

  let token: string;
  try {
    const auth = await medusa.registerCustomer(email, password);
    token = auth.token;
    await medusa.createCustomer(token, {
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    });

    // The token from the register route is identity-only: it proves the email
    // exists but `/store/customers/me` rejects it with 401. Storing it as the
    // session left every new account redirected straight back to the sign-in
    // page — the account existed, but the buyer could never reach it.
    // Signing in returns a proper customer session token.
    const session = await medusa.loginCustomer(email, password);
    token = session.token;
  } catch (error) {
    console.error("Registration failed", error);
    localeRedirect("/account/register?error=exists", await getLocale());
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  // A new account should keep whatever they had in the basket while signing up.
  await claimCartForCustomer(token);

  await sendAccountEmail({
    to: email,
    template: "welcome",
    data: { first_name: firstName || null },
    eventKey: `welcome:${email}`,
  });

  localeRedirect("/account", await getLocale());
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  localeRedirect("/", await getLocale());
}
