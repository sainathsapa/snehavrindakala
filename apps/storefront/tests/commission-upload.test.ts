import { describe, expect, it } from "vitest";
import {
  validateCommissionFile,
  parseAttachmentList,
  MAX_COMMISSION_FILE_BYTES,
  MAX_COMMISSION_FILES,
} from "../lib/commission-upload";

describe("validateCommissionFile", () => {
  it("accepts an allowed image type within size", () => {
    const r = validateCommissionFile("image/jpeg", 1024);
    expect(r).toEqual({ ok: true, ext: "jpg" });
  });

  it("accepts png, webp and pdf", () => {
    expect(validateCommissionFile("image/png", 10).ext).toBe("png");
    expect(validateCommissionFile("image/webp", 10).ext).toBe("webp");
    expect(validateCommissionFile("application/pdf", 10).ext).toBe("pdf");
  });

  it("rejects a disallowed type", () => {
    const r = validateCommissionFile("image/svg+xml", 10);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/JPG, PNG, WebP/);
  });

  it("rejects an empty file", () => {
    expect(validateCommissionFile("image/png", 0).ok).toBe(false);
  });

  it("rejects a file over the size cap but allows exactly the cap", () => {
    expect(validateCommissionFile("image/png", MAX_COMMISSION_FILE_BYTES + 1).ok).toBe(false);
    expect(validateCommissionFile("image/png", MAX_COMMISSION_FILE_BYTES).ok).toBe(true);
  });
});

describe("parseAttachmentList", () => {
  it("returns [] for empty or invalid input", () => {
    expect(parseAttachmentList("")).toEqual([]);
    expect(parseAttachmentList(undefined)).toEqual([]);
    expect(parseAttachmentList("not json")).toEqual([]);
    expect(parseAttachmentList(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  it("parses a valid list", () => {
    const raw = JSON.stringify([
      { key: "abc.jpg", mime_type: "image/jpeg", size_bytes: 123, original_filename: "a.jpg" },
    ]);
    expect(parseAttachmentList(raw)).toEqual([
      { key: "abc.jpg", mime_type: "image/jpeg", size_bytes: 123, original_filename: "a.jpg" },
    ]);
  });

  it("drops entries without a key string", () => {
    const raw = JSON.stringify([
      { key: "ok.jpg", mime_type: "image/jpeg", size_bytes: 1 },
      { mime_type: "image/jpeg" },
      { key: "" },
      null,
    ]);
    const out = parseAttachmentList(raw);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("ok.jpg");
  });

  it("caps the number of attachments", () => {
    const many = Array.from({ length: MAX_COMMISSION_FILES + 3 }, (_, i) => ({
      key: `k${i}.jpg`,
      mime_type: "image/jpeg",
      size_bytes: 1,
    }));
    expect(parseAttachmentList(JSON.stringify(many))).toHaveLength(MAX_COMMISSION_FILES);
  });

  it("coerces missing optional fields to safe defaults", () => {
    const out = parseAttachmentList(JSON.stringify([{ key: "x.pdf" }]));
    expect(out[0]).toMatchObject({
      key: "x.pdf",
      mime_type: "application/octet-stream",
      size_bytes: 0,
      original_filename: null,
    });
  });
});
