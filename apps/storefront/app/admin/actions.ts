"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { medusa } from "@/lib/medusa";
import { AUTH_COOKIE } from "@/lib/auth";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Admin login: authenticates as a Medusa customer, then restricts access
 * to emails listed in ADMIN_EMAILS. Sets the same auth cookie used by the
 * customer account system so /admin/partners can resolve the current user.
 */
export async function adminLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/admin/login?error=missing");
  }

  if (!ADMIN_EMAILS.includes(email)) {
    redirect("/admin/login?error=not_admin");
  }

  let token: string;
  try {
    const result = await medusa.loginCustomer(email, password);
    token = result.token;
  } catch (error) {
    console.error("Admin login failed", error);
    redirect("/admin/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/admin/partners");
}

export async function adminLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/");
}
