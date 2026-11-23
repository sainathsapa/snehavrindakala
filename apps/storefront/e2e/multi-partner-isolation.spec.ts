import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

/**
 * FINAL GO — Wave 6, Scenarios C and G (tenant isolation + role checks).
 *
 * Scenario C: a signed-in partner A session attempts DIRECT API access
 *   (GET / PATCH / POST) to partner B's products, orders, inventory, earnings,
 *   shipments and downloads. Every attempt must be refused (401 / 403 / 404)
 *   and must leak none of B's data.
 * Scenario G: role checks — operations / finance / viewer cannot exercise
 *   permissions their role does not hold; owner can; anonymous is always 401.
 *
 * ---------------------------------------------------------------------------
 * GATE HONESTY — READ BEFORE TRUSTING A RUN
 * ---------------------------------------------------------------------------
 * SKIPPED unless `E2E_SANDBOX=1` AND the sandbox credentials below are set AND
 * a running stack + sandbox fixture service is reachable. Partner identities,
 * resource ids and a unique "marker" string are seeded by the fixture service
 * or read from env — none are fabricated here. The marker is written into B's
 * fixture rows so a leak can be asserted on deterministically. A SKIP is an
 * honest "NOT VERIFIED", NEVER a pass. Do not remove the gate to force green.
 *
 * Required env (names only):
 *   E2E_SANDBOX=1, E2E_FIXTURES_URL, E2E_FIXTURES_TOKEN,
 *   E2E_PARTNER_A_EMAIL / E2E_PARTNER_A_PASSWORD,
 *   (Scenario G) E2E_PARTNER_OWNER_EMAIL / _PASSWORD,
 *   E2E_PARTNER_OPERATIONS_EMAIL / _PASSWORD,
 *   E2E_PARTNER_FINANCE_EMAIL / _PASSWORD,
 *   E2E_PARTNER_VIEWER_EMAIL / _PASSWORD.
 *
 * Endpoint contract (partner portal, supplied by the PART-PORTAL / INTEGRATE
 * workstreams): /api/partner/{products,inventory,orders,earnings,shipments,
 * team,profile,security}. A fulfilment group is addressed as
 * /api/partner/orders/:id, not /api/partner/fulfilment-groups/:id. Routes for
 * downloads and settlements are probed too: their absence (404) is itself a
 * safe refusal. Every tenant read derives partner_id from the signed
 * server-side session — never from a request body, query string or header
 * (AGENT_CONTRACT hard rule #5).
 * ---------------------------------------------------------------------------
 */

const SANDBOX = process.env.E2E_SANDBOX === "1";

const BASE_ENV = [
  "E2E_FIXTURES_URL",
  "E2E_FIXTURES_TOKEN",
  "E2E_PARTNER_A_EMAIL",
  "E2E_PARTNER_A_PASSWORD",
] as const;

const ROLE_ENV = [
  "E2E_PARTNER_OWNER_EMAIL", "E2E_PARTNER_OWNER_PASSWORD",
  "E2E_PARTNER_OPERATIONS_EMAIL", "E2E_PARTNER_OPERATIONS_PASSWORD",
  "E2E_PARTNER_FINANCE_EMAIL", "E2E_PARTNER_FINANCE_PASSWORD",
  "E2E_PARTNER_VIEWER_EMAIL", "E2E_PARTNER_VIEWER_PASSWORD",
] as const;

function absent(names: readonly string[]): string[] {
  return names.filter((name) => {
    const value = process.env[name];
    return !value || value.trim() === "";
  });
}

function gateReason(missing: string[]): string {
  return [
    "Requires E2E_SANDBOX=1, sandbox credentials and a running stack",
    "(Next + Medusa + Postgres + sandbox fixtures).",
    missing.length ? `Unconfigured env vars (names only): ${missing.join(", ")}.` : "",
    "SKIPPED = NOT VERIFIED, never a pass.",
  ]
    .filter(Boolean)
    .join(" ");
}

const REASON_C = gateReason(absent(BASE_ENV));
const REASON_G = gateReason(absent(ROLE_ENV));
const READY_C = SANDBOX && absent(BASE_ENV).length === 0;
const READY_G = SANDBOX && absent(ROLE_ENV).length === 0;

function env(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required sandbox env var: ${name}`);
  }
  return value;
}

// ----- helpers ------------------------------------------------------------

async function fixture(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<APIResponse> {
  const base = env("E2E_FIXTURES_URL").replace(/\/$/, "");
  return request.fetch(`${base}${path}`, {
    method,
    headers: {
      "x-fixture-token": env("E2E_FIXTURES_TOKEN"),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    data: body,
    failOnStatusCode: false,
  });
}

async function signInPartner(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post("/api/partner/auth/login", {
    data: { email, password },
    failOnStatusCode: false,
  });
  expect(res.status(), `login for ${email.split("@")[0]} succeeds`).toBe(200);
  // APIResponse has no cookies() method; the login response's Set-Cookie is
  // stored in this test's APIRequestContext cookie jar.
  const cookies: Array<{ name: string; value: string }> = await request.cookies();
  const session = cookies.find(
    (cookie: { name: string; value: string }) => cookie.name === "svk_partner_session"
  );
  expect(session, "signed partner session cookie is set").toBeTruthy();
  return `svk_partner_session=${session!.value}`;
}

/** Refusal statuses only. 200/201/204 here would be a tenant-isolation breach. */
const REFUSAL = [401, 403, 404];

async function expectNoLeak(
  label: string,
  res: APIResponse,
  secretMarker: string
): Promise<void> {
  expect(REFUSAL, `${label} must be a refusal status`).toContain(res.status());
  const body = await res.text().catch(() => "");
  expect(body, `${label} must not echo partner B's marker`).not.toContain(secretMarker);
  expect(body, `${label} must not return partner B's order ids`).not.toMatch(
    /ord_[A-Za-z0-9]+/ // only meaningful because the marker/id shape comes from the fixture
  );
}

// ----- Scenario C ---------------------------------------------------------

test.describe("Scenario C — cross-partner direct API access is refused", () => {
  test.skip(!READY_C, REASON_C);

  test("partner A cannot read or mutate partner B's tenant data", async ({ request }) => {
    // Fixture seeds partner B's tenant with a unique marker we can assert on.
    const seeded = await fixture(request, "POST", "/tenants/partner-b/seed", {});
    expect(seeded.status(), "seed partner B tenant").toBe(201);
    const tenantB = await seeded.json();
    const marker: string = tenantB.marker;
    expect(marker, "fixture supplies a unique leak marker — do not fabricate").toBeTruthy();
    expect(marker.length).toBeGreaterThan(8);

    const cookieA = await signInPartner(
      request,
      env("E2E_PARTNER_A_EMAIL"),
      env("E2E_PARTNER_A_PASSWORD")
    );
    const h = { Cookie: cookieA };

    // Sanity: partner A's OWN session is valid (a blanket 401 would hide a bug).
    const own = await request.get("/api/partner/auth/session", {
      headers: h,
      failOnStatusCode: false,
    });
    expect(own.status(), "partner A session is valid").toBe(200);

    const id = (key: string): string => {
      const value = tenantB.resources?.[key];
      expect(value, `fixture provides B's ${key}`).toBeTruthy();
      return String(value);
    };

    const groupId = id("fulfilment_group_id");

    // Direct access to B-owned resources must be refused outright.
    const attempts: Array<{
      label: string;
      method: "GET" | "PATCH" | "POST";
      path: string;
      data?: unknown;
    }> = [
      { label: "GET B product", method: "GET", path: `/api/partner/products/${id("product_id")}` },
      { label: "PATCH B product", method: "PATCH", path: `/api/partner/products/${id("product_id")}`, data: { title: marker } },
      { label: "GET B order group", method: "GET", path: `/api/partner/orders/${groupId}` },
      { label: "POST accept on B group", method: "POST", path: `/api/partner/orders/${groupId}/accept`, data: {} },
      { label: "POST fulfil on B group", method: "POST", path: `/api/partner/orders/${groupId}/fulfil`, data: { to: "delivered" } },
      { label: "GET B download", method: "GET", path: `/api/partner/downloads/${id("download_id")}` },
    ];

    for (const attempt of attempts) {
      const res = await request.fetch(attempt.path, {
        method: attempt.method,
        headers: { ...h, "content-type": "application/json" },
        data: attempt.data,
        failOnStatusCode: false,
      });
      await expectNoLeak(attempt.label, res, marker);
    }

    // Scoped list routes legitimately answer 200 with A's OWN rows. The
    // security assertion there is that none of B's marker/ids come back.
    const scoped: Array<{ label: string; path: string }> = [
      { label: "inventory list with B variant in query", path: `/api/partner/inventory?variant_id=${encodeURIComponent(id("variant_id"))}` },
      { label: "earnings with B order in query", path: `/api/partner/earnings?order_id=${encodeURIComponent(id("order_id"))}` },
      { label: "shipments list", path: "/api/partner/shipments" },
      { label: "orders list", path: "/api/partner/orders" },
    ];
    for (const check of scoped) {
      const res = await request.get(check.path, {
        headers: h,
        failOnStatusCode: false,
      });
      expect([200, 401, 403], `${check.label} status`).toContain(res.status());
      const body = await res.text().catch(() => "");
      expect(body, `${check.label} must not leak B's marker`).not.toContain(marker);
      expect(body, `${check.label} must not leak B's product id`).not.toContain(id("product_id"));
    }

    // Inventory mutations are intentionally not exposed to partners. A PATCH
    // attempt is a safe refusal (405) and must never reach B's stock.
    const mutation = await request.patch("/api/partner/inventory", {
      headers: { ...h, "content-type": "application/json" },
      data: { variant_id: id("variant_id"), stock: 99 },
      failOnStatusCode: false,
    });
    expect([400, 401, 403, 404, 405], "partner inventory PATCH is refused").toContain(
      mutation.status()
    );
    expect(await mutation.text()).not.toContain(marker);
  });

  test("forged partner_id in body, query and header cannot widen access", async ({ request }) => {
    const seeded = await fixture(request, "POST", "/tenants/partner-b/seed", {});
    expect(seeded.status(), "seed partner B tenant").toBe(201);
    const tenantB = await seeded.json();
    const marker: string = tenantB.marker;
    const forgedId = String(tenantB.resources.partner_id);

    const cookieA = await signInPartner(
      request,
      env("E2E_PARTNER_A_EMAIL"),
      env("E2E_PARTNER_A_PASSWORD")
    );
    const session = await request.get("/api/partner/auth/session", {
      headers: { Cookie: cookieA },
      failOnStatusCode: false,
    });
    expect(session.status(), "partner A session is valid").toBe(200);
    const sessionBody = await session.json();
    const partnerAId = String(sessionBody.partner_id ?? sessionBody.partnerId ?? sessionBody.partner?.id);
    expect(partnerAId, "session exposes A's own partner id").toBeTruthy();
    expect(partnerAId).not.toBe(forgedId);

    // AGENT_CONTRACT hard rule #5: a partner_id supplied by the client must be
    // ignored; the tenant is derived from the signed session. Each vector tries
    // to smuggle B's id past that rule using A's valid cookie.
    // A client-supplied partner_id on a write is rejected outright; the tenant
    // is derived from the signed session only.
    const body = await request.post("/api/partner/products", {
      headers: { Cookie: cookieA, "content-type": "application/json" },
      data: {
        partner_id: forgedId,
        product_id: tenantB.resources.product_id,
        title: marker,
      },
      failOnStatusCode: false,
    });
    expect(body.status(), "partner_id in body is refused").toBe(400);
    const bodyText = await body.text().catch(() => "");
    expect(bodyText, "forged body must not leak B's marker").not.toContain(marker);
    expect(bodyText).toMatch(/partner_id cannot be supplied/i);

    // On reads, the forged id in query/header is ignored: A sees only A's rows.
    for (const vector of [
      `/api/partner/earnings?partner_id=${encodeURIComponent(forgedId)}`,
      `/api/partner/orders?partner_id=${encodeURIComponent(forgedId)}`,
      `/api/partner/inventory?partner_id=${encodeURIComponent(forgedId)}`,
    ]) {
      const res = await request.get(vector, {
        headers: { Cookie: cookieA, "x-partner-id": forgedId },
        failOnStatusCode: false,
      });
      const text = await res.text().catch(() => "");
      expect(text, `forged query/header ${vector} must not leak B's marker`).not.toContain(marker);
      expect(text, `forged query/header ${vector} must not echo B's id`).not.toContain(forgedId);
      if (res.ok()) {
        const payload = JSON.parse(text);
        if (payload.partnerId !== undefined) {
          expect(String(payload.partnerId), "tenant derives from session").toBe(partnerAId);
        }
      } else {
        expect(REFUSAL).toContain(res.status());
      }
    }
  });
});

// ----- Scenario G ---------------------------------------------------------

test.describe("Scenario G — partner role permissions", () => {
  test.skip(!READY_G, REASON_G);

  type Role = "owner" | "operations" | "finance" | "viewer";
  const CREDENTIALS: Record<Role, [string, string]> = {
    owner: ["E2E_PARTNER_OWNER_EMAIL", "E2E_PARTNER_OWNER_PASSWORD"],
    operations: ["E2E_PARTNER_OPERATIONS_EMAIL", "E2E_PARTNER_OPERATIONS_PASSWORD"],
    finance: ["E2E_PARTNER_FINANCE_EMAIL", "E2E_PARTNER_FINANCE_PASSWORD"],
    viewer: ["E2E_PARTNER_VIEWER_EMAIL", "E2E_PARTNER_VIEWER_PASSWORD"],
  };

  /** Mirrors lib/partner/rbac.ts PARTNER_ROLE_PERMISSIONS. */
  const MATRIX: Record<Role, Array<{ label: string; perm: string; method: "GET" | "POST"; path: string; allowed: boolean }>> = {
    owner: [
      { label: "products:read", perm: "products:read", method: "GET", path: "/api/partner/products", allowed: true },
      { label: "products:write", perm: "products:write", method: "POST", path: "/api/partner/products", allowed: true },
      { label: "earnings:read", perm: "earnings:read", method: "GET", path: "/api/partner/earnings", allowed: true },
      { label: "team:write", perm: "team:write", method: "POST", path: "/api/partner/team", allowed: true },
      { label: "security:write", perm: "security:write", method: "POST", path: "/api/partner/security/password", allowed: true },
    ],
    operations: [
      { label: "orders:read", perm: "orders:read", method: "GET", path: "/api/partner/orders", allowed: true },
      { label: "inventory:read", perm: "inventory:read", method: "GET", path: "/api/partner/inventory", allowed: true },
      { label: "earnings:read", perm: "earnings:read", method: "GET", path: "/api/partner/earnings", allowed: false },
      { label: "products:write", perm: "products:write", method: "POST", path: "/api/partner/products", allowed: false },
      { label: "security:write", perm: "security:write", method: "POST", path: "/api/partner/security/password", allowed: false },
    ],
    finance: [
      { label: "earnings:read", perm: "earnings:read", method: "GET", path: "/api/partner/earnings", allowed: true },
      { label: "profile:read", perm: "profile:read", method: "GET", path: "/api/partner/profile", allowed: true },
      { label: "products:read", perm: "products:read", method: "GET", path: "/api/partner/products", allowed: false },
      { label: "products:write", perm: "products:write", method: "POST", path: "/api/partner/products", allowed: false },
      { label: "team:write", perm: "team:write", method: "POST", path: "/api/partner/team", allowed: false },
    ],
    viewer: [
      { label: "products:read", perm: "products:read", method: "GET", path: "/api/partner/products", allowed: true },
      { label: "orders:read", perm: "orders:read", method: "GET", path: "/api/partner/orders", allowed: true },
      { label: "products:write", perm: "products:write", method: "POST", path: "/api/partner/products", allowed: false },
      { label: "team:write", perm: "team:write", method: "POST", path: "/api/partner/team", allowed: false },
      { label: "security:write", perm: "security:write", method: "POST", path: "/api/partner/security/password", allowed: false },
    ],
  };

  for (const role of Object.keys(MATRIX) as Role[]) {
    test(`${role} can only exercise its granted permissions`, async ({ request }) => {
      const [emailVar, passwordVar] = CREDENTIALS[role];
      const cookie = await signInPartner(request, env(emailVar), env(passwordVar));

      for (const check of MATRIX[role]) {
        const res = await request.fetch(check.path, {
          method: check.method,
          headers: { Cookie: cookie, "content-type": "application/json" },
          data: check.method === "POST" ? {} : undefined,
          failOnStatusCode: false,
        });
        if (check.allowed) {
          // An allowed permission means the RBAC gate let the request through.
          // The route's own body validation may still answer 400/422 for the
          // empty test payload; that is not a permission denial.
          expect([401, 403], `${role} should not be denied ${check.label}`).not.toContain(
            res.status()
          );
        } else {
          expect([401, 403], `${role} must be denied ${check.label}`).toContain(res.status());
        }
      }
    });
  }

  test("anonymous requests are refused everywhere", async ({ request }) => {
    for (const path of [
      "/api/partner/products",
      "/api/partner/orders",
      "/api/partner/earnings",
      "/api/partner/shipments",
      "/api/partner/inventory",
      "/api/partner/team",
      "/api/partner/profile",
    ]) {
      const res = await request.get(path, { failOnStatusCode: false });
      expect([401, 403], `anonymous ${path}`).toContain(res.status());
    }
  });
});
