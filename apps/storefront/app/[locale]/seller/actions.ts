"use server";

import { localeRedirect } from "@/lib/locale-redirect";
import { getLocale } from "next-intl/server";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";

export async function applySellerAction(formData: FormData): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    localeRedirect("/account/login", await getLocale());
  }

  const application = {
    studio_name: String(formData.get("studio_name") || "").trim(),
    disciplines: String(formData.get("disciplines") || "").trim(),
    capacity: String(formData.get("capacity") || "").trim(),
    portfolio: String(formData.get("portfolio") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };

  try {
    await medusa.updateCustomer(token, {
      metadata: { seller_application: application },
    });
  } catch (error) {
    console.error("Seller application failed", error);
    localeRedirect("/seller?error=save", await getLocale());
  }

  localeRedirect("/seller", await getLocale());
}
