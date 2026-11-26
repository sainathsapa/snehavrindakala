/**
 * Svix signature verification, by hand.
 *
 * Resend signs webhooks with Svix. The scheme is HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}`, keyed with the base64-decoded
 * `whsec_…` secret — small enough that a dependency would be more surface than
 * it saves.
 *
 * It lives in lib, not in the route file, because a Next.js route module may
 * only export its handlers: exporting a helper from `route.ts` fails the build.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** How far a timestamp may drift before the request is treated as a replay. */
export const MAX_SKEW_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify a Svix signature header.
 *
 * The header looks like `v1,<base64sig> v1,<base64sig2>`: more than one entry
 * appears while a secret is rotating, and any match is valid.
 */
export function verifySvixSignature(params: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
  header: string;
  /** Injectable clock, so a replay test does not have to wait. */
  now?: number;
}): boolean {
  const { secret, id, timestamp, body, header } = params;
  if (!secret || !id || !timestamp || !header) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const now = Math.floor((params.now ?? Date.now()) / 1000);
  if (Math.abs(now - sent) > MAX_SKEW_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return header
    .split(" ")
    .map((entry) => entry.split(","))
    .some(
      (parts) =>
        parts.length === 2 && parts[0] === "v1" && safeEqual(parts[1], expected)
    );
}
