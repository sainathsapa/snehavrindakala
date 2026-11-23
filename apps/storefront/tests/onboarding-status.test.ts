import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Public application-status tracking: the lookup must be keyed by the opaque
 * application reference, return only allow-listed public fields, map cleanly to
 * a 404 for an unknown id, and present a friendly message that never carries
 * internal reviewer identity.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ query: mockQuery }));

import {
  getApplicationStatus,
  statusMessage,
  PUBLIC_STATUS_FIELDS,
  type ApplicationStatus,
  type StatusExecutor,
} from "../lib/partner-onboarding/status";

/** A DB row as it might be selected, deliberately including sensitive fields. */
const ROW = {
  id: "app-1",
  display_name: "Vidya Handicrafts",
  legal_name: "Vidya Handicrafts LLP",
  contact_email: "owner@vidya.example",
  contact_phone: "+91 98765 43210",
  business_details: { registration: "UNCONFIGURED" },
  document_keys: ["doc-1"],
  review_status: "pending",
  review_notes: null,
  reviewed_by: "admin@internal.example",
  reviewed_at: null,
  created_partner_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

interface Call {
  sql: string;
  params: any[];
}

function fakeExecutor(rows: any[]): { ex: StatusExecutor; calls: Call[] } {
  const calls: Call[] = [];
  const ex: StatusExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    return rows;
  };
  return { ex, calls };
}

async function callGet(id: string) {
  const { GET } = await import(
    "../app/api/store/partner-applications/[id]/route"
  );
  const response = await GET(new Request("http://localhost/api/status"), {
    params: Promise.resolve({ id }),
  });
  return { status: response.status, json: await response.json() };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("getApplicationStatus", () => {
  it("returns the allow-listed status for a known reference", async () => {
    const { ex, calls } = fakeExecutor([ROW]);
    const status = await getApplicationStatus("app-1", ex);

    expect(status).toEqual({
      id: "app-1",
      display_name: "Vidya Handicrafts",
      review_status: "pending",
      review_notes: null,
      reviewed_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_partner_id: null,
    });
    expect(Object.keys(status!)).toEqual([...PUBLIC_STATUS_FIELDS]);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual(["app-1"]);
  });

  it("selects only public columns — never PII, secrets or reviewer identity", async () => {
    const { ex, calls } = fakeExecutor([ROW]);
    await getApplicationStatus("app-1", ex);
    const sql = calls[0].sql;

    expect(sql).toContain("FROM partner_onboarding_application");
    expect(sql).toContain("WHERE id = $1");
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    for (const field of PUBLIC_STATUS_FIELDS) expect(sql).toContain(field);
    for (const forbidden of [
      "contact_email",
      "contact_phone",
      "legal_name",
      "business_details",
      "artist_information",
      "document_keys",
      "reviewed_by",
      "updated_at",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it("returns null for an unknown reference", async () => {
    const { ex, calls } = fakeExecutor([]);
    expect(await getApplicationStatus("does-not-exist", ex)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("returns null for a blank id without touching the database", async () => {
    const { ex, calls } = fakeExecutor([ROW]);
    expect(await getApplicationStatus("   ", ex)).toBeNull();
    expect(await getApplicationStatus(null, ex)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("statusMessage", () => {
  it("maps every review status to a friendly message", () => {
    expect(statusMessage("pending")).toMatch(/review queue/i);
    expect(statusMessage("more_info")).toMatch(/more information/i);
    expect(statusMessage("approved")).toMatch(/approved/i);
    expect(statusMessage("rejected")).toMatch(/weren't able to approve/i);
  });

  it("uses a safe fallback for an unknown status", () => {
    expect(statusMessage("something-else")).toMatch(/check back/i);
    expect(statusMessage(null)).toMatch(/check back/i);
  });

  it("shows the applicant-facing reason for a rejection", () => {
    const message = statusMessage("rejected", "  incomplete documents  ");
    expect(message).toContain("incomplete documents");
    expect(message).not.toContain("admin@internal.example");
  });

  it("shows the reason attached to a more-info request", () => {
    expect(statusMessage("more_info", "please upload a portfolio")).toContain(
      "please upload a portfolio"
    );
  });
});

describe("public status GET endpoint", () => {
  it("returns the status plus a message for a known reference", async () => {
    mockQuery.mockResolvedValue([ROW]);
    const result = await callGet("app-1");

    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      id: "app-1",
      display_name: "Vidya Handicrafts",
      review_status: "pending",
    });
    expect(result.json.message).toMatch(/review queue/i);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(["app-1"]);
  });

  it("returns 404 for an unknown reference", async () => {
    mockQuery.mockResolvedValue([]);
    const result = await callGet("missing");
    expect(result.status).toBe(404);
    expect(result.json).toHaveProperty("error");
  });

  it("returns 404 for an empty reference without querying", async () => {
    const result = await callGet("   ");
    expect(result.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("never exposes sensitive fields or reviewer identity in the response", async () => {
    mockQuery.mockResolvedValue([ROW]);
    const result = await callGet("app-1");

    const allowedKeys = new Set<string>([...PUBLIC_STATUS_FIELDS, "message"]);
    expect(Object.keys(result.json).every((key) => allowedKeys.has(key))).toBe(
      true
    );

    const body = JSON.stringify(result.json);
    for (const forbidden of [
      "contact_email",
      "owner@vidya.example",
      "contact_phone",
      "legal_name",
      "business_details",
      "document_keys",
      "reviewed_by",
      "admin@internal.example",
      "updated_at",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("surfaces the rejection reason in the response message", async () => {
    mockQuery.mockResolvedValue([
      {
        ...ROW,
        review_status: "rejected",
        review_notes: "incomplete documents",
        reviewed_by: "admin@internal.example",
      },
    ]);
    const result = await callGet("app-1");

    expect(result.status).toBe(200);
    expect(result.json.review_status).toBe("rejected");
    expect(result.json.message).toContain("incomplete documents");
    expect(JSON.stringify(result.json)).not.toContain("admin@internal.example");
  });
});
