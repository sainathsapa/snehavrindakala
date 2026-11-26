/**
 * Resend delivery webhook.
 *
 * The old SES→SNS route verified an SNS certificate; this one verifies a Svix
 * HMAC. Both exist for the same reason: `sent` is not delivery, and only a
 * signed provider event may move a notification to `delivered`.
 */

import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifySvixSignature } from "@/lib/webhooks/svix";

const SECRET = "whsec_" + Buffer.from("test-signing-key-32-bytes-long!!").toString("base64");

function sign(body: string, { id = "msg_1", timestamp, secret = SECRET } = {} as any) {
  const ts = String(timestamp ?? Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return { id, timestamp: ts, header: `v1,${sig}` };
}

describe("verifySvixSignature", () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });

  it("accepts a correctly signed body", () => {
    const s = sign(body);
    expect(
      verifySvixSignature({ secret: SECRET, id: s.id, timestamp: s.timestamp, header: s.header, body })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const s = sign(body);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: s.id,
        timestamp: s.timestamp,
        header: s.header,
        body: body.replace("delivered", "bounced"),
      })
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const s = sign(body, { secret: "whsec_" + Buffer.from("another-key-another-key-another").toString("base64") });
    expect(
      verifySvixSignature({ secret: SECRET, id: s.id, timestamp: s.timestamp, header: s.header, body })
    ).toBe(false);
  });

  it("rejects a replayed timestamp outside the skew window", () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60;
    const s = sign(body, { timestamp: old });
    expect(
      verifySvixSignature({ secret: SECRET, id: s.id, timestamp: s.timestamp, header: s.header, body })
    ).toBe(false);
  });

  it("accepts any v1 entry while a secret is being rotated", () => {
    const s = sign(body);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: s.id,
        timestamp: s.timestamp,
        header: `v1,bm90LXRoZS1yaWdodC1zaWc= ${s.header}`,
        body,
      })
    ).toBe(true);
  });

  it("refuses an empty header, id or timestamp", () => {
    expect(verifySvixSignature({ secret: SECRET, id: "", timestamp: "1", header: "v1,x", body })).toBe(false);
    expect(verifySvixSignature({ secret: SECRET, id: "a", timestamp: "", header: "v1,x", body })).toBe(false);
    expect(verifySvixSignature({ secret: SECRET, id: "a", timestamp: "1", header: "", body })).toBe(false);
    expect(verifySvixSignature({ secret: "", id: "a", timestamp: "1", header: "v1,x", body })).toBe(false);
  });
});
