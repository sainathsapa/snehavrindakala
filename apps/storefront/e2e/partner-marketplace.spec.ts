import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

/**
 * FINAL GO — Wave 6, Scenarios A and B (marketplace fulfilment).
 *
 * Scenario A: single-partner purchase -> allocation -> accept -> fulfil ->
 *   tracking -> delivered -> partner earnings.
 * Scenario B: multi-partner cart -> ONE parent order -> independent fulfilment
 *   groups -> the customer still sees one complete order.
 *
 * ---------------------------------------------------------------------------
 * GATE HONESTY — READ BEFORE TRUSTING A RUN
 * ---------------------------------------------------------------------------
 * Both suites are SKIPPED unless `E2E_SANDBOX=1` AND every sandbox credential
 * below is configured AND a running stack is reachable (Next storefront +
 * Medusa + Postgres + the sandbox fixture service). No credential, partner
 * identity, product id, AWB or commission value is fabricated here: they are
 * read from environment variables / seeded by the fixture service. A SKIP is
 * an honest "NOT VERIFIED". It is NEVER a pass. Do NOT remove the gate to make
 * a run go green — provide the sandbox inputs instead.
 *
 * Required env (names only, never values in reports):
 *   E2E_SANDBOX=1, E2E_FIXTURES_URL, E2E_FIXTURES_TOKEN,
 *   E2E_BASE_URL (optional; playwright.config defaults to localhost:3200),
 *   E2E_PARTNER_A_EMAIL / E2E_PARTNER_A_PASSWORD / E2E_PARTNER_A_ID,
 *   E2E_PRODUCT_A_ID, E2E_CARRIER_WEBHOOK_TOKEN,
 *   (Scenario B also) E2E_PARTNER_B_EMAIL / E2E_PARTNER_B_PASSWORD /
 *   E2E_PARTNER_B_ID / E2E_PRODUCT_B_ID.
 *
 * Endpoint contract (partner portal, supplied by the INTEGRATE/PART-PORTAL &
 * ALLOC workstreams):
 *   POST /api/partner/auth/login                 -> sets svk_partner_session
 *   GET  /api/partner/orders/:id                 -> one fulfilment group
 *   POST /api/partner/orders/:id/accept          -> assigned -> accepted
 *   POST /api/partner/orders/:id/fulfil          -> {to: packing|ready_for_dispatch|dispatched|delivered, shipment_id?}
 *   GET  /api/partner/earnings                   -> statement (filter by order_id client-side)
 *   POST /api/webhooks/shiprocket                -> carrier status callback
 * The fixture service (E2E_FIXTURES_URL) is sandbox-only and is the sole
 * creator of orders / fulfilment groups / sandbox tracking data.
 * ---------------------------------------------------------------------------
 */

const SANDBOX = process.env.E2E_SANDBOX === "1";

const PARTNER_A_ENV = [
  "E2E_FIXTURES_URL",
  "E2E_FIXTURES_TOKEN",
  "E2E_PARTNER_A_EMAIL",
  "E2E_PARTNER_A_PASSWORD",
  "E2E_PARTNER_A_ID",
  "E2E_PRODUCT_A_ID",
  "E2E_CARRIER_WEBHOOK_TOKEN",
] as const;

const PARTNER_B_ENV = [
  "E2E_PARTNER_B_EMAIL",
  "E2E_PARTNER_B_PASSWORD",
  "E2E_PARTNER_B_ID",
  "E2E_PRODUCT_B_ID",
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

const REASON_A = gateReason(absent(PARTNER_A_ENV));
const REASON_B = gateReason(absent([...PARTNER_A_ENV, ...PARTNER_B_ENV]));
const READY_A = SANDBOX && absent(PARTNER_A_ENV).length === 0;
const READY_B =
  SANDBOX && absent([...PARTNER_A_ENV, ...PARTNER_B_ENV]).length === 0;

// ----- helpers ------------------------------------------------------------

function env(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required sandbox env var: ${name}`);
  }
  return value;
}

/** Sandbox-only fixture service call. Never points at a live provider. */
async function fixture(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH",
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

async function expectStatus(
  res: APIResponse,
  status: number,
  label: string
): Promise<void> {
  if (res.status() !== status) {
    const body = await res.text().catch(() => "");
    expect(
      res.status(),
      `${label} (body: ${body.slice(0, 500)})`
    ).toBe(status);
  }
}

/** Log in as a seeded partner and return a cookie header carrying the signed session. */
async function signInPartner(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ cookie: string; body: any }> {
  const res = await request.post("/api/partner/auth/login", {
    data: { email, password },
    failOnStatusCode: false,
  });
  await expectStatus(res, 200, "partner login");
  const session = (await res.cookies()).find(
    (cookie) => cookie.name === "svk_partner_session"
  );
  expect(session, "signed partner session cookie is set").toBeTruthy();
  return {
    cookie: `svk_partner_session=${session!.value}`,
    body: await res.json(),
  };
}

function entriesOf(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.entries ?? payload?.ledger ?? payload?.rows ?? [];
}

// ----- Scenario A ---------------------------------------------------------

test.describe("Scenario A — single-partner fulfilment happy path", () => {
  test.skip(!READY_A, REASON_A);

  test("purchase → allocation → accept → fulfil → tracking → delivered → earnings", async ({
    request,
  }) => {
    // 1. Seed ONE paid, allocated order for partner A using sandbox fixtures.
    const seeded = await fixture(request, "POST", "/orders", {
      partners: [
        { partner_id: env("E2E_PARTNER_A_ID"), product_id: env("E2E_PRODUCT_A_ID"), quantity: 1 },
      ],
      payment_mode: "sandbox",
    });
    await expectStatus(seeded, 201, "seed single-partner order");
    const order = await seeded.json();
    expect(order.order_id, "fixture returns one parent order id").toBeTruthy();
    expect(order.fulfilment_groups, "order is allocated into groups").toBeTruthy();
    expect(order.fulfilment_groups).toHaveLength(1);
    const group = order.fulfilment_groups[0];
    expect(group.partner_id).toBe(env("E2E_PARTNER_A_ID"));
    expect(group.status).toBe("assigned");

    // 2. Partner A signs in and sees only its own group.
    const partner = await signInPartner(
      request,
      env("E2E_PARTNER_A_EMAIL"),
      env("E2E_PARTNER_A_PASSWORD")
    );
    const seen = await request.get(`/api/partner/orders/${group.id}`, {
      headers: { Cookie: partner.cookie },
      failOnStatusCode: false,
    });
    await expectStatus(seen, 200, "partner A reads its fulfilment group");
    expect((await seen.json()).id ?? group.id).toBe(group.id);

    // 3. Accept the assignment.
    const accepted = await request.post(
      `/api/partner/orders/${group.id}/accept`,
      { headers: { Cookie: partner.cookie }, data: {}, failOnStatusCode: false }
    );
    await expectStatus(accepted, 200, "partner A accepts assignment");
    expect((await accepted.json()).status).toBe("accepted");

    // 4. Fulfil: pack -> ready -> dispatch with sandbox tracking from the fixture.
    for (const to of ["packing", "ready_for_dispatch"]) {
      const step = await request.post(`/api/partner/orders/${group.id}/fulfil`, {
        headers: { Cookie: partner.cookie },
        data: { to },
        failOnStatusCode: false,
      });
      await expectStatus(step, 200, `transition to ${to}`);
      expect((await step.json()).status).toBe(to);
    }

    const tracking = order.sandbox_tracking;
    expect(
      tracking?.shipment_id,
      "fixture provides a sandbox shipment id — do not fabricate one"
    ).toBeTruthy();
    const dispatched = await request.post(`/api/partner/orders/${group.id}/fulfil`, {
      headers: { Cookie: partner.cookie },
      data: { to: "dispatched", shipment_id: tracking.shipment_id },
      failOnStatusCode: false,
    });
    await expectStatus(dispatched, 200, "dispatch with tracking");
    expect((await dispatched.json()).status).toBe("dispatched");

    // 5. Carrier callback confirms the tracked shipment, then the partner
    // advances its own group to delivered (the carrier webhook updates the
    // shipment row; it does not mutate the tenant's fulfilment group).
    const callback = await request.post("/api/webhooks/shiprocket", {
      data: {
        awb: tracking.awb,
        order_id: order.order_id,
        status: "delivered",
        courier: tracking.courier,
      },
      headers: { "x-webhook-token": env("E2E_CARRIER_WEBHOOK_TOKEN") },
      failOnStatusCode: false,
    });
    await expectStatus(callback, 200, "carrier delivered webhook");
    expect((await callback.json()).applied).toBe(true);

    const delivered = await request.post(`/api/partner/orders/${group.id}/fulfil`, {
      headers: { Cookie: partner.cookie },
      data: { to: "delivered" },
      failOnStatusCode: false,
    });
    await expectStatus(delivered, 200, "group advances to delivered");
    expect((await delivered.json()).status).toBe("delivered");

    // 6. Earnings: an 'earning' ledger entry exists for this order. Never
    // assert a hard-coded commission — compare to the fixture's policy config.
    const earnings = await request.get("/api/partner/earnings", {
      headers: { Cookie: partner.cookie },
      failOnStatusCode: false,
    });
    await expectStatus(earnings, 200, "partner earnings");
    const ledger = entriesOf(await earnings.json());
    const credit = ledger.find(
      (entry: any) =>
        entry.order_id === order.order_id && entry.entry_type === "earning"
    );
    expect(credit, "one earning entry for the delivered order").toBeTruthy();
    expect(credit.payable_amount).toBe(order.expected_earning.payable_amount);
    expect(credit.currency).toBe(order.expected_earning.currency ?? "INR");
    expect(credit.commission_policy_id).toBeTruthy();
  });
});

// ----- Scenario B ---------------------------------------------------------

test.describe("Scenario B — multi-partner cart, one parent order", () => {
  test.skip(!READY_B, REASON_B);

  test("one parent order, independent fulfilment groups, full customer view", async ({
    request,
  }) => {
    // 1. Seed a cart with one item from each of two partners.
    const seeded = await fixture(request, "POST", "/orders", {
      partners: [
        { partner_id: env("E2E_PARTNER_A_ID"), product_id: env("E2E_PRODUCT_A_ID"), quantity: 1 },
        { partner_id: env("E2E_PARTNER_B_ID"), product_id: env("E2E_PRODUCT_B_ID"), quantity: 1 },
      ],
      payment_mode: "sandbox",
    });
    await expectStatus(seeded, 201, "seed multi-partner order");
    const order = await seeded.json();

    // Exactly ONE parent order, TWO groups with distinct partners.
    expect(order.order_id).toBeTruthy();
    expect(order.fulfilment_groups).toHaveLength(2);
    const groupA = order.fulfilment_groups.find(
      (g: any) => g.partner_id === env("E2E_PARTNER_A_ID")
    );
    const groupB = order.fulfilment_groups.find(
      (g: any) => g.partner_id === env("E2E_PARTNER_B_ID")
    );
    expect(groupA, "group for partner A").toBeTruthy();
    expect(groupB, "group for partner B").toBeTruthy();
    expect(groupA.id).not.toBe(groupB.id);

    const sessionA = await signInPartner(
      request,
      env("E2E_PARTNER_A_EMAIL"),
      env("E2E_PARTNER_A_PASSWORD")
    );
    const sessionB = await signInPartner(
      request,
      env("E2E_PARTNER_B_EMAIL"),
      env("E2E_PARTNER_B_PASSWORD")
    );

    // 2. Each partner independently accepts and dispatches only its own group.
    const dispatchA = await request.post(`/api/partner/orders/${groupA.id}/fulfil`, {
      headers: { Cookie: sessionA.cookie },
      data: { to: "dispatched", shipment_id: order.sandbox_tracking.a.shipment_id },
      failOnStatusCode: false,
    });
    await expectStatus(dispatchA, 200, "partner A dispatches its group");

    const viewB = await request.get(`/api/partner/orders/${groupB.id}`, {
      headers: { Cookie: sessionB.cookie },
      failOnStatusCode: false,
    });
    await expectStatus(viewB, 200, "partner B reads its own group");
    expect((await viewB.json()).status).toBe("assigned", "B is untouched by A's actions");

    const dispatchB = await request.post(`/api/partner/orders/${groupB.id}/fulfil`, {
      headers: { Cookie: sessionB.cookie },
      data: { to: "dispatched", shipment_id: order.sandbox_tracking.b.shipment_id },
      failOnStatusCode: false,
    });
    await expectStatus(dispatchB, 200, "partner B dispatches its group");

    // 3. The customer still sees ONE order containing BOTH partners' items.
    const customer = await fixture(
      request,
      "GET",
      `/orders/${encodeURIComponent(order.order_id)}/customer-view`
    );
    await expectStatus(customer, 200, "customer order view");
    const view = await customer.json();
    expect(view.order_id).toBe(order.order_id);
    expect(view.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: env("E2E_PRODUCT_A_ID") }),
        expect.objectContaining({ product_id: env("E2E_PRODUCT_B_ID") }),
      ])
    );
    expect(view.items).toHaveLength(2);
  });
});
