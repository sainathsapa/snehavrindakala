/**
 * Social profiles, shown in the footer and linked from structured data.
 *
 * These are read from the environment rather than hard-coded, because a wrong
 * or invented handle is worse than no link: it sends buyers to a stranger's
 * account. A profile only appears in the footer once its URL is actually set,
 * so an unconfigured store shows nothing instead of a dead icon.
 */

export type SocialLink = {
  id: string;
  label: string;
  href: string;
};

/** Env var name for each network, in display order. */
const SOCIAL_ENV: { id: string; label: string; env: string }[] = [
  { id: "instagram", label: "Instagram", env: "NEXT_PUBLIC_SOCIAL_INSTAGRAM" },
  { id: "facebook", label: "Facebook", env: "NEXT_PUBLIC_SOCIAL_FACEBOOK" },
  { id: "pinterest", label: "Pinterest", env: "NEXT_PUBLIC_SOCIAL_PINTEREST" },
  { id: "youtube", label: "YouTube", env: "NEXT_PUBLIC_SOCIAL_YOUTUBE" },
  { id: "linkedin", label: "LinkedIn", env: "NEXT_PUBLIC_SOCIAL_LINKEDIN" },
  { id: "x", label: "X", env: "NEXT_PUBLIC_SOCIAL_X" },
];

/**
 * Every configured profile, or an empty array when none are set.
 *
 * Only `http(s)` URLs are accepted. A value like `instagram.com/foo` with no
 * scheme would be treated by the browser as a path on our own site, which is
 * exactly the broken link this guard exists to prevent.
 */
export function socialLinks(): SocialLink[] {
  const links: SocialLink[] = [];
  for (const entry of SOCIAL_ENV) {
    const raw = process.env[entry.env]?.trim();
    if (!raw) continue;
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      links.push({ id: entry.id, label: entry.label, href: url.toString() });
    } catch {
      // Not a URL at all — skip rather than render a broken link.
    }
  }
  return links;
}

/** Just the URLs, for `sameAs` in schema.org Organization markup. */
export function socialUrls(): string[] {
  return socialLinks().map((link) => link.href);
}
