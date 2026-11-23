import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { auditPayload, redactAuditText } from "@/lib/partner-audit/audit";

/**
 * Lead integration hardening for two independent-QA findings:
 *  - F1: the backend dev/CI email preview logged the raw recipient and body.
 *  - F2: camelCase keys such as `apiToken` evaded key-based audit redaction.
 * Static + pure assertions; no live DB, email or credentials.
 */

const repo = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

describe("F1 — dev/CI email preview never logs raw PII", () => {
  const transport = read("apps/backend/src/modules/notification/transport.ts");

  it("scrubs recipient, subject and body before the skipped-preview log", () => {
    const preview = transport.slice(
      transport.indexOf("console.log("),
      transport.indexOf("return { status: \"skipped\"")
    );
    expect(preview).toMatch(/scrubPii\(payload\.to\)/);
    expect(preview).toMatch(/scrubPii\(payload\.subject\)/);
    expect(preview).toMatch(/scrubPii\(payload\.text\)/);
    expect(preview).not.toMatch(/\$\{payload\.to\}/);
  });

  it("the scrubber redacts emails and card-like numbers", () => {
    // Exercise the same regexes through the storefront's equivalent helper;
    // the backend helper is mirrored and asserted statically above.
    expect(redactAuditText("write to buyer@example.test now")).not.toMatch(
      /buyer@example\.test/
    );
    expect(redactAuditText("card 4111111111111111")).not.toMatch(
      /4111111111111111/
    );
  });
});

describe("F2 — camelCase sensitive keys are redacted", () => {
  it("normalises camelCase before matching the sensitive-key rule", () => {
    const payload = auditPayload(
      "test.action",
      { partnerId: "p1", role: "partner_owner" } as any,
      {
        apiToken: "tok_live_secret",
        refreshToken: "refresh_secret",
        sessionId: "sess_secret",
        harmlessField: "visible",
      }
    );
    expect(JSON.stringify(payload)).not.toMatch(/tok_live_secret/);
    expect(JSON.stringify(payload)).not.toMatch(/refresh_secret/);
    expect(JSON.stringify(payload)).not.toMatch(/sess_secret/);
    expect(JSON.stringify(payload)).toMatch(/visible/);
  });

  it("splits camelCase in the normaliser (source-level guard)", () => {
    const src = read("apps/storefront/lib/partner-audit/audit.ts");
    expect(src).toMatch(/\.replace\(\/\(\[a-z0-9\]\)\(\[A-Z\]\)\/g, "\$1 \$2"\)/);
  });
});
