/**
 * Ways to reach a person, without paying for an API.
 *
 * WhatsApp is where this shop's buyers actually are, and the Business API has a
 * monthly cost and a review process that a studio selling a few works a month
 * cannot justify. `wa.me` links need neither: a tap opens WhatsApp with the
 * message written, and the buyer presses send. Nothing is automated, nothing
 * costs, and the first message still comes from the customer rather than from a
 * bot they did not ask for.
 *
 * The number comes from SELLER_PHONE (the same one on the invoice), so there is
 * one place to change it and no second source of truth.
 */

const digits = (value: string) => String(value || "").replace(/[^\d]/g, "");

export function supportNumber(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    process.env.SELLER_PHONE ||
    process.env.CONTACT_PHONE ||
    "";
  const clean = digits(raw);
  // E.164 without the plus; wa.me wants 10–15 digits, country code included.
  if (clean.length < 10 || clean.length > 15) return null;
  return clean;
}

/**
 * A WhatsApp link with the message already written.
 *
 * Returns null when no number is configured, so the caller renders nothing rather
 * than a dead button.
 */
export function whatsappLink(message: string): string | null {
  const number = supportNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** A mailto with subject and body, always available. */
export function mailtoLink(subject: string, body = ""): string {
  const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.CONTACT_EMAIL || "";
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${to}?${params.toString()}`;
}

/** Share a work: WhatsApp and Facebook have web intents; Instagram does not. */
export function shareLinks(url: string, title: string) {
  const text = `${title} — SnehaVrinda Kala`;
  return {
    whatsapp: whatsappLink(`${text}\n${url}`),
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    /** Instagram has no web share intent; the honest route is to copy the link. */
    copy: url,
  };
}
