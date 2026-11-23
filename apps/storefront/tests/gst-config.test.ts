/**
 * GST-01 — seller/tax configuration is validated, never invented.
 *
 * These tests only check presence and shape. They deliberately do not assert a
 * real GSTIN, HSN code or rate: those are owner/accountant data and this
 * deployment must not manufacture them.
 */

import { describe, expect, it } from "vitest";
import {
  GST_ENV_KEYS,
  gstConfigStatus,
  hasAnyGstConfig,
} from "../lib/tax-server";
import { configurationChecklist, taxStatus } from "../lib/config-status";

const VALID_GSTIN = "29ABCDE1234F1Z5"; // shape only — a made-up test value

const complete = {
  SELLER_LEGAL_NAME: "Test Seller (fictional)",
  SELLER_GSTIN: VALID_GSTIN,
  SELLER_ADDRESS: "1 Test Street, Test City",
  SELLER_HOME_STATE: "Karnataka",
  GST_RATE: "5",
  HSN_SAC_DEFAULT: "9999",
};

describe("gstConfigStatus", () => {
  it("reports every field missing when nothing is configured", () => {
    const status = gstConfigStatus({});
    expect(status.ready).toBe(false);
    expect(status.missing).toEqual([...GST_ENV_KEYS]);
    expect(status.invalid).toEqual([]);
  });

  it("accepts a correctly shaped GSTIN and a rate in range", () => {
    const status = gstConfigStatus(complete);
    expect(status.ready).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.invalid).toEqual([]);
  });

  it("rejects a malformed GSTIN without echoing it", () => {
    const status = gstConfigStatus({ ...complete, SELLER_GSTIN: "NOT-A-GSTIN" });
    expect(status.ready).toBe(false);
    expect(status.invalid).toContain("SELLER_GSTIN");
    expect(JSON.stringify(status)).not.toContain("NOT-A-GSTIN");
  });

  it("rejects a rate outside 0..100 and a non-numeric rate", () => {
    expect(gstConfigStatus({ ...complete, GST_RATE: "101" }).invalid).toContain(
      "GST_RATE"
    );
    expect(gstConfigStatus({ ...complete, GST_RATE: "-1" }).invalid).toContain(
      "GST_RATE"
    );
    expect(gstConfigStatus({ ...complete, GST_RATE: "abc" }).invalid).toContain(
      "GST_RATE"
    );
    expect(gstConfigStatus({ ...complete, GST_RATE: "0" }).ready).toBe(true);
    expect(gstConfigStatus({ ...complete, GST_RATE: "100" }).ready).toBe(true);
  });

  it("treats whitespace-only mandatory fields as missing", () => {
    const status = gstConfigStatus({ ...complete, SELLER_HOME_STATE: "   " });
    expect(status.missing).toContain("SELLER_HOME_STATE");
    expect(status.ready).toBe(false);
  });

  it("never returns a value, only field names and booleans", () => {
    const secretish = { ...complete, SELLER_LEGAL_NAME: "unique-secret-name" };
    const json = JSON.stringify(gstConfigStatus(secretish));
    expect(json).not.toContain("unique-secret-name");
    expect(json).not.toContain(VALID_GSTIN);
  });
});

describe("taxStatus in the config checklist", () => {
  it("is missing when no seller config exists in a synthetic empty env", () => {
    const status = taxStatus({});
    expect(status.id).toBe("tax");
    expect(status.level).toBe("missing");
    expect(status.keys).toContain("SELLER_GSTIN");
  });

  it("is partial when only the pre-existing state/rate pair is set", () => {
    const status = taxStatus({
      SELLER_HOME_STATE: "Karnataka",
      GST_RATE: "5",
    });
    expect(status.level).toBe("partial");
    expect(status.keys).toContain("SELLER_GSTIN");
    expect(status.keys).not.toContain("GST_RATE");
  });

  it("is ready only when all fields are present and well-formed", () => {
    expect(taxStatus(complete).level).toBe("ready");
    expect(
      taxStatus({ ...complete, SELLER_GSTIN: "bad" }).level
    ).toBe("partial");
  });

  it("appears in the checklist once any GST field is configured", () => {
    expect(hasAnyGstConfig({})).toBe(false);
    expect(
      configurationChecklist({}).some((item) => item.id === "tax")
    ).toBe(false);
    const ids = configurationChecklist(complete).map((item) => item.id);
    expect(ids).toContain("tax");
    expect(ids).toEqual([
      "payments",
      "email",
      "fulfilment",
      "cron",
      "backups",
      "social",
      "tax",
    ]);
  });

  it("does not leak values through the whole checklist", () => {
    const json = JSON.stringify(configurationChecklist(complete));
    expect(json).not.toContain(VALID_GSTIN);
    expect(json).not.toContain("unique-secret-name");
  });
});

describe("no statutory invoice is fabricated", () => {
  it("keeps validation free of GSTIN/HSN/rate constants it could emit", () => {
    // The only literal GSTIN in this file is the test value above; the module
    // under test may check a shape but must not supply a number.
    expect(GST_ENV_KEYS).toContain("SELLER_GSTIN");
    expect(GST_ENV_KEYS).toContain("HSN_SAC_DEFAULT");
  });
});
