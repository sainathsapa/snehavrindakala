import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  reconciliationStatusLabel,
  issueTypeLabel,
  refundExecutionStatusLabel,
  moneyLabel,
  whenLabel,
  sandboxPaymentConfig,
  REFUND_EXECUTION_STATUS_LABEL,
} from "@/lib/admin/finance-view";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const routeSource = read("app/api/admin/marketplace/finance/route.ts");
const reconSource = read("app/admin/marketplace/reconciliation/page.tsx");
const refundsSource = read("app/admin/marketplace/refunds/page.tsx");

/* ── pure status label helpers ──────────────────────────────────────────── */

describe("reconciliationStatusLabel (pure)", () => {
  it("labels every reconciliation status in operator language", () => {
    expect(reconciliationStatusLabel("open")).toMatch(/open/i);
    expect(reconciliationStatusLabel("retrying")).toMatch(/retry/i);
    expect(reconciliationStatusLabel("resolved")).toMatch(/resolved/i);
    expect(reconciliationStatusLabel("escalated")).toMatch(/escalat/i);
  });

  it("falls back for an unknown status instead of leaking the raw value", () => {
    expect(reconciliationStatusLabel("banana")).toBe("unknown status");
    expect(reconciliationStatusLabel("")).toBe("unknown status");
  });
});

describe("issueTypeLabel (pure)", () => {
  it("labels every issue type from migration 004", () => {
    const types = [
      "captured_unconfirmed",
      "authorized_unconfirmed",
      "failed_order_created",
      "duplicate_payment",
      "amount_mismatch",
      "webhook_missed",
    ];
    for (const type of types) {
      expect(issueTypeLabel(type), type).not.toBe("unknown issue");
      expect(issueTypeLabel(type), type).not.toBe(type);
    }
    expect(issueTypeLabel("captured_unconfirmed")).toMatch(/captured/i);
    expect(issueTypeLabel("amount_mismatch")).toMatch(/amount/i);
  });

  it("falls back for unknown issue types", () => {
    expect(issueTypeLabel("something_new")).toBe("unknown issue");
  });
});

describe("refundExecutionStatusLabel (pure)", () => {
  it("says plainly that provider_confirmed is the only money-moved state", () => {
    expect(refundExecutionStatusLabel("provider_confirmed")).toMatch(/money has moved/i);
  });

  it("does not let an internal approval sound like a paid refund", () => {
    const approved = refundExecutionStatusLabel("approved");
    expect(approved).toMatch(/NOT moved/i);
    expect(approved).not.toMatch(/money has moved/i);
  });

  it("covers pending, initiated, failed and reversed", () => {
    expect(refundExecutionStatusLabel("pending")).toMatch(/nothing sent/i);
    expect(refundExecutionStatusLabel("initiated")).toMatch(/not confirmed/i);
    expect(refundExecutionStatusLabel("failed")).toMatch(/nothing moved/i);
    expect(refundExecutionStatusLabel("reversed")).toMatch(/returned/i);
  });

  it("falls back for unknown statuses and keeps the map strict", () => {
    expect(refundExecutionStatusLabel("banana")).toBe("unknown status");
    expect(Object.keys(REFUND_EXECUTION_STATUS_LABEL).sort()).toEqual(
      ["approved", "failed", "initiated", "pending", "provider_confirmed", "reversed"].sort()
    );
  });
});

describe("display helpers (pure)", () => {
  it("formats paise as INR and handles non-numeric values", () => {
    expect(moneyLabel(123400)).toContain("1,234");
    expect(moneyLabel("5000")).toContain("50");
    expect(moneyLabel("not-a-number")).toBe("—");
    expect(moneyLabel(null)).toBe("—");
  });

  it("formats dates and degrades gracefully for missing or invalid dates", () => {
    expect(whenLabel("2026-01-15T10:30:00Z")).toMatch(/2026/);
    expect(whenLabel(null)).toBe("—");
    expect(whenLabel("")).toBe("—");
    expect(whenLabel("not-a-date")).toBe("—");
  });
});

/* ── sandbox readiness: names only, never values ───────────────────────── */

describe("sandboxPaymentConfig (pure, presence-only)", () => {
  it("reports UNCONFIGURED with field names when sandbox credentials are absent", () => {
    const result = sandboxPaymentConfig({});
    expect(result.configured).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
      ])
    );
  });

  it("is configured only when every sandbox credential has a real value", () => {
    const full = {
      RAZORPAY_KEY_ID: "rzp_test_x",
      RAZORPAY_KEY_SECRET: "a-secret",
      RAZORPAY_WEBHOOK_SECRET: "a-webhook-secret",
    };
    expect(sandboxPaymentConfig(full).configured).toBe(true);
    expect(sandboxPaymentConfig(full).missing).toEqual([]);
    // One missing value is still not configured (no partial credit).
    const { RAZORPAY_WEBHOOK_SECRET: _omit, ...partial } = full;
    expect(sandboxPaymentConfig(partial).configured).toBe(false);
  });

  it("treats placeholder values as unset (no partial credit)", () => {
    const placeholders = {
      RAZORPAY_KEY_ID: "0",
      RAZORPAY_KEY_SECRET: "false",
      RAZORPAY_WEBHOOK_SECRET: "undefined",
    };
    const result = sandboxPaymentConfig(placeholders);
    expect(result.configured).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it("never echoes a credential value in the report — names only", () => {
    const secrets = {
      RAZORPAY_KEY_ID: "rzp_test_SECRETVALUE_XYZ",
      RAZORPAY_KEY_SECRET: "TOPSECRET_KEY_VALUE",
      RAZORPAY_WEBHOOK_SECRET: "WEBHOOK_ONLY_NAME",
    };
    const serialised = JSON.stringify(sandboxPaymentConfig(secrets));
    for (const value of Object.values(secrets)) {
      expect(serialised).not.toContain(value);
    }
  });
});

/* ── static access-control / no-client-approval assertions ─────────────── */

const financeSources = [
  { path: "app/api/admin/marketplace/finance/route.ts", source: routeSource },
  { path: "app/admin/marketplace/reconciliation/page.tsx", source: reconSource },
  { path: "app/admin/marketplace/refunds/page.tsx", source: refundsSource },
];

const GATE = /requirePermission\(\s*["']refunds:read["']\s*\)/;

describe("admin finance access control (static)", () => {
  it("the finance API and both pages gate on requirePermission('refunds:read')", () => {
    for (const file of financeSources) {
      expect(file.source, `${file.path} must gate on refunds:read`).toMatch(GATE);
    }
  });

  it("the route distinguishes unauthenticated (401) from forbidden (403)", () => {
    expect(routeSource).toMatch(/getAdminIdentity/);
    expect(routeSource).toMatch(/status: 401/);
    expect(routeSource).toMatch(/identity\.role === ["']partner["']/);
    expect(routeSource).toMatch(/status: 403/);
  });

  it("both pages block the partner-tenant role", () => {
    for (const source of [reconSource, refundsSource]) {
      expect(source).toMatch(/identity\.role === ["']partner["']/);
    }
  });

  it("no file accepts a client-supplied approver or approval decision", () => {
    // The data is read-only. There is no request body, no query/header lookup
    // of an approver, and no client-side decision form on either screen.
    const forbidden = [
      '"use client"',
      "searchParams",
      "headers.get(",
      "req.json(",
      "request.json(",
      "req.body",
      "body.approved_by",
      "body.approver",
      "body.requester",
      "method: \"POST\"",
      "decideRefund(",
      "executeRefund(",
      "<form",
    ];
    for (const file of financeSources) {
      for (const token of forbidden) {
        expect(file.source, `${file.path} must not contain ${token}`).not.toContain(token);
      }
    }
    // The approver/requester are derived from the session and the stored row.
    expect(routeSource).toContain("getAdminIdentity()");
    expect(refundsSource).toContain("requested_by IS NOT NULL"); // query filters, not form input
  });
});

describe("admin finance screens show the right operational facts (static)", () => {
  it("the reconciliation screen lists status, attempts, next_attempt_at and issue_type", () => {
    for (const token of ["issue_type", "status", "attempts", "next_attempt_at"]) {
      expect(reconSource, `reconciliation page must show ${token}`).toContain(token);
    }
    expect(reconSource).toContain("/api/cron/reconcile-payments");
  });

  it("the reconciliation screen shows a banner when sandbox credentials are missing", () => {
    expect(reconSource).toMatch(/sandboxPaymentConfig\(\)/);
    expect(reconSource).toContain("Sandbox payment credentials are not configured");
    expect(reconSource).toMatch(/config\.missing/);
  });

  it("the refunds screen shows executions and pending approvals with dual control", () => {
    expect(refundsSource).toContain("FROM refund_execution");
    expect(refundsSource).toContain("FROM order_refunds");
    expect(refundsSource).toContain("approved_by IS NULL");
    expect(refundsSource).toContain("provider_confirmed");
    expect(refundsSource).toMatch(/requested_by/);
    expect(refundsSource).toMatch(/approved_by/);
    expect(refundsSource).toMatch(/can never be/);
  });

  it("all read paths use the shared query helper over migrations 003-004 tables", () => {
    expect(routeSource).toMatch(/import\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*["']@\/lib\/db["']/);
    expect(reconSource).toMatch(/import\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*["']@\/lib\/db["']/);
    expect(refundsSource).toMatch(/import\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*["']@\/lib\/db["']/);
    for (const table of [
      "payment_reconciliation_issue",
      "refund_execution",
      "order_refunds",
    ]) {
      expect(routeSource, `finance route must query ${table}`).toContain(table);
    }
  });
});
