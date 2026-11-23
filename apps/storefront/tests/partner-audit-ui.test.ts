import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatAuditActionLabel } from "@/app/partner/audit/page";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const PAGE = "app/partner/audit/page.tsx";
const source = read(PAGE);

describe("partner audit page — server-side wiring (static source checks)", () => {
  it("gates with requirePartnerPermission('profile:read') and redirects unauthenticated users", () => {
    expect(source).toMatch(
      /requirePartnerPermission\(\s*["']profile:read["']\s*\)/
    );
    expect(source).toMatch(/redirect\(["']\/partner\/login["']\)/);
  });

  it("reads the trail only through the tenant-scoped listPartnerAudit(ctx)", () => {
    expect(source).toMatch(/listPartnerAudit\(ctx\)/);
    expect(source).toMatch(/from\s+["']@\/lib\/partner-audit\/audit["']/);
    // No raw/tenant-agnostic DB query from the page itself — scoping lives in A77.
    expect(source).not.toMatch(/\bquery\s*\(/);
    expect(source).not.toMatch(/\btenantQuery\s*\(/);
  });

  it("never imports the platform audit_log module or admin audit surface", () => {
    const specifiers = Array.from(source.matchAll(/from\s+["']([^"']+)["']/g)).map(
      (m) => m[1]
    );
    const forbidden = new Set([
      "@/lib/audit",
      "@/lib/admin",
      "@/lib/admin-partners",
      "@/lib/admin-partners/platform",
      "@/app/admin",
      "@/app/admin/audit-log",
      "@/app/api/admin",
    ]);
    for (const spec of specifiers) {
      expect(forbidden.has(spec), `forbidden platform import: ${spec}`).toBe(false);
    }
    for (const name of [
      "recordAdminAction",
      "listAuditLog",
      "getAuditLog",
      "admin/audit-log",
    ]) {
      expect(source.includes(name), `forbidden admin audit symbol: ${name}`).toBe(false);
    }
    // The platform `audit_log` table must never be read here (partner_audit_log,
    // accessed through listPartnerAudit, is the only permitted source).
    expect(source).not.toMatch(/\baudit_log\b/);
  });

  it("renders action, entity, time and actor columns", () => {
    for (const header of ["Action", "Entity", "Time", "Actor"]) {
      expect(source, `missing column header: ${header}`).toMatch(
        new RegExp(`>\\s*${header}(?:\\s*\\([^)]*\\))?\\s*<`)
      );
    }
    expect(source).toMatch(/formatAuditActionLabel\(row\.action\)/);
    expect(source).toMatch(/row\.actor_email/);
    expect(source).toMatch(/row\.actor_role/);
    expect(source).toMatch(/row\.created_at/);
    expect(source).toMatch(/entityLabel\(row\)/);
  });

  it("states that the trail shows only this partner's own activity", () => {
    expect(source).toMatch(/Your activity only/i);
    expect(source).toMatch(/only actions performed by members of/i);
    expect(source).toMatch(/does not include\s+activity from any other partner/i);
    expect(source).not.toMatch(/all partners/i);
  });

  it("takes no partner id from the client (query/header/body/params)", () => {
    expect(source).not.toMatch(/searchParams/);
    expect(source).not.toMatch(/\bheaders\s*\(/);
    expect(source).not.toMatch(/\bparams\b/);
    expect(source).not.toMatch(/partner_id\s*[:=]/);
    expect(source).not.toMatch(/\brequest\b/);
  });
});

describe("formatAuditActionLabel — pure action label mapping (A77 codes)", () => {
  const canonical: Record<string, string> = {
    MEMBER_INVITED: "Member invited",
    MEMBER_ROLE_CHANGED: "Member role changed",
    MEMBER_SUSPENDED: "Member suspended",
    SESSIONS_REVOKED: "Sessions revoked",
    PROFILE_UPDATED: "Business profile updated",
    PRODUCT_SUBMITTED: "Product submitted",
    ORDER_ACCEPTED: "Order accepted",
    ORDER_REJECTED: "Order rejected",
    ORDER_FULFILLED: "Order fulfilled",
    SETTLEMENT_VIEWED: "Settlement viewed",
  };

  it("maps every canonical audit action to a human-readable label", () => {
    for (const [code, label] of Object.entries(canonical)) {
      expect(formatAuditActionLabel(code), code).toBe(label);
    }
  });

  it("humanises unknown/custom actions instead of hiding them", () => {
    expect(formatAuditActionLabel("SOME_NEW_ACTION")).toBe("Some New Action");
    expect(formatAuditActionLabel("REFUND_REQUESTED")).toBe("Refund Requested");
    expect(formatAuditActionLabel("  PRODUCT_SUBMITTED  ")).toBe("Product submitted");
  });

  it("falls back to an explicit label for an empty action", () => {
    expect(formatAuditActionLabel("")).toBe("Unknown action");
    expect(formatAuditActionLabel("   ")).toBe("Unknown action");
  });

  it("is pure: deterministic and does not mutate its input", () => {
    const input = "MEMBER_INVITED";
    expect(formatAuditActionLabel(input)).toBe(formatAuditActionLabel(input));
    expect(input).toBe("MEMBER_INVITED");
  });
});
