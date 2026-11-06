"use server";

import { redirect } from "next/navigation";
import { medusa } from "@/lib/medusa";

export async function createCommissionAction(
  formData: FormData
): Promise<void> {
  const artForm = String(formData.get("art_form") || "").trim();
  const brief = String(formData.get("brief") || "").trim();
  const budget = String(formData.get("budget_range") || "").trim();
  const targetDate = String(formData.get("target_date") || "").trim();
  const deliveryPin = String(formData.get("delivery_pin") || "").trim();

  if (!artForm || !brief) {
    redirect("/custom-art?error=missing");
  }

  let referenceId: string;
  try {
    const response = await medusa.createCommissionRequest({
      art_form: artForm,
      brief,
      budget_range: budget || undefined,
      target_date: targetDate || undefined,
      delivery_pin: deliveryPin || undefined,
    });
    referenceId = response.reference_id;
  } catch (error) {
    console.error("Failed to create commission request", error);
    redirect("/custom-art?error=submit");
  }

  redirect(`/commission-status/${encodeURIComponent(referenceId)}`);
}
