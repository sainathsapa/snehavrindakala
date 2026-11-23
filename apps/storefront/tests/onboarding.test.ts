import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Public partner onboarding: the validator is the single gate between an
 * untrusted form body and an INSERT, and the route must never echo a client
 * supplied status back as if the application had been reviewed.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ query: mockQuery }));

import { validateApplication } from "../lib/partner-onboarding/validation";

function validInput() {
  return {
    legal_name: "  Sneha Handicrafts LLP  ",
    display_name: "  Sneha Studio  ",
    contact_email: "  studio@example.com  ",
    contact_phone: "+91 98765 43210",
    business_details: {
      description: "Hand-built ceramics and textiles.",
      business_type: "Partnership",
    },
    artist_information: {
      studio_name: "Sneha Studio",
      practice: "Ceramics",
    },
    product_categories: ["Ceramics & pottery", "Textiles & fibre"],
    document_keys: ["doc_abc123", "https://example.com/portfolio"],
  };
}

async function callApi(body: unknown, raw = false) {
  const { POST } = await import("../app/api/store/partner-applications/route");
  const response = await POST(
    new Request("http://localhost/api/store/partner-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
  return { status: response.status, json: await response.json() };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("validateApplication", () => {
  it("accepts a complete application and normalises it", () => {
    const result = validateApplication(validInput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.value).not.toBeNull();
    expect(result.value).toMatchObject({
      legal_name: "Sneha Handicrafts LLP",
      display_name: "Sneha Studio",
      contact_email: "studio@example.com",
      product_categories: ["Ceramics & pottery", "Textiles & fibre"],
      document_keys: ["doc_abc123", "https://example.com/portfolio"],
    });
  });

  it("rejects missing required fields", () => {
    const result = validateApplication({
      legal_name: "",
      display_name: "   ",
      business_details: {},
      product_categories: [],
    });
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveProperty("legal_name");
    expect(result.errors).toHaveProperty("display_name");
    expect(result.errors).toHaveProperty("contact_email");
    expect(result.errors).toHaveProperty("business_details");
    expect(result.errors).toHaveProperty("product_categories");
  });

  it("rejects an invalid email address", () => {
    const input = validInput();
    input.contact_email = "not-an-email";
    const result = validateApplication(input);
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors.contact_email).toMatch(/valid email/i);
  });

  it("requires business_details to be a non-empty object and categories a non-empty array", () => {
    const badObject = validateApplication({ ...validInput(), business_details: "nope" });
    expect(badObject.ok).toBe(false);
    expect(badObject.errors).toHaveProperty("business_details");

    const badCategories = validateApplication({ ...validInput(), product_categories: [] });
    expect(badCategories.ok).toBe(false);
    expect(badCategories.errors).toHaveProperty("product_categories");
  });

  it("drops client-supplied status fields instead of carrying them forward", () => {
    const result = validateApplication({
      ...validInput(),
      status: "approved",
      review_status: "approved",
    });
    expect(result.ok).toBe(true);
    expect(result.value).not.toHaveProperty("status");
    expect(result.value).not.toHaveProperty("review_status");
  });
});

describe("POST /api/store/partner-applications", () => {
  it("inserts a pending application and returns its id", async () => {
    mockQuery.mockResolvedValue([{ id: "app_123" }]);
    const result = await callApi(validInput());

    expect(result.status).toBe(201);
    expect(result.json).toEqual({ id: "app_123", status: "pending" });
    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO partner_onboarding_application/i);
    expect(sql).toMatch(/'pending'/);
    expect(params).toHaveLength(8);
    expect(params[2]).toBe("studio@example.com");
    expect(params[4]).toBe(JSON.stringify(validInput().business_details));
    expect(params[6]).toBe(JSON.stringify(validInput().product_categories));
  });

  it("never trusts a client status", async () => {
    mockQuery.mockResolvedValue([{ id: "app_123" }]);
    const result = await callApi({
      ...validInput(),
      status: "approved",
      review_status: "approved",
    });

    expect(result.status).toBe(201);
    expect(result.json.status).toBe("pending");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/review_status/);
    expect(params).not.toContain("approved");
  });

  it("rejects an invalid body without touching the database", async () => {
    const invalid = validInput();
    delete (invalid as Record<string, unknown>).contact_email;
    const result = await callApi(invalid);

    expect(result.status).toBe(400);
    expect(result.json).toHaveProperty("errors");
    expect(result.json.errors).toHaveProperty("contact_email");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const result = await callApi("{not json", true);
    expect(result.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("reports a database failure as 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockRejectedValue(new Error("db down"));
    const result = await callApi(validInput());
    expect(result.status).toBe(500);
    expect(result.json).toHaveProperty("error");
    consoleSpy.mockRestore();
  });
});
