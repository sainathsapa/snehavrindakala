"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { medusa } from "@/lib/medusa";
import { AUTH_COOKIE } from "@/lib/auth";
import { claimCartForCustomer } from "@/lib/cart";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/account/login?error=missing");
  }

  let token: string;
  try {
    const result = await medusa.loginCustomer(email, password);
    token = result.token;
  } catch (error) {
    console.error("Login failed", error);
    redirect("/account/login?error=invalid");
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

  redirect("/account");
}

export async function registerAction(formData: FormData): Promise<void> {
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/account/register?error=missing");
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
  } catch (error) {
    console.error("Registration failed", error);
    redirect("/account/register?error=exists");
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

  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/");
}
