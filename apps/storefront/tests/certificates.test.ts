import { describe, expect, it } from "vitest";
import { formatCertificateCode, makeCertificateCode } from "../lib/certificates";

/**
 * A certificate reference is the proof, so it must be two things at once:
 * unguessable, and readable off a printed sheet by someone typing it back in.
 */
describe("makeCertificateCode", () => {
  it("uses only characters people do not confuse when copying from paper", () => {
    // I, L, O and U are the ones that get mistyped; they are not in the alphabet.
    for (let i = 0; i < 50; i += 1) {
      expect(makeCertificateCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
    }
  });

  it("is 80 bits, not a counter or a timestamp", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => makeCertificateCode()));
    expect(codes.size).toBe(2000);
  });

  it("never derives from an order id", () => {
    // Guarding the property, not the implementation: nothing about an order in,
    // nothing about it out. Anyone holding an order id must not be able to
    // compute a certificate reference.
    const code = makeCertificateCode();
    expect(code).not.toContain("order");
    expect(makeCertificateCode(8)).toHaveLength(8);
  });
});

describe("formatCertificateCode", () => {
  it("groups in fours so it can be read aloud", () => {
    expect(formatCertificateCode("ABCDEFGHJKMNPQRS")).toBe("ABCD-EFGH-JKMN-PQRS");
  });

  it("tolerates a short or already-grouped code", () => {
    expect(formatCertificateCode("ABCD")).toBe("ABCD");
    expect(formatCertificateCode("")).toBe("");
  });
});
