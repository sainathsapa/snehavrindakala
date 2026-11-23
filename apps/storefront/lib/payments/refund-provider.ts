/**
 * Refund provider adapter.
 *
 * Refunds move real money, so the execution layer never builds a provider call
 * itself — it receives a `RefundProvider`. In tests and local development the
 * injected adapter is `TestRefundProvider`, which only produces deterministic
 * fake ids. `RazorpayRefundProvider` is the real adapter and refuses to exist
 * without owner-supplied credentials; this code never invents a key.
 */

import { createHash } from "node:crypto";

export interface RefundParams {
  amount: number;
  currency?: string;
  orderId: string;
  refundRequestId?: string;
  /** Stable caller key; providers use it to deduplicate a retried request. */
  idempotencyKey: string;
  /** Required for a live Razorpay refund; optional for the test adapter. */
  paymentId?: string;
  reason?: string;
}

export interface ProviderRefund {
  providerRefundId: string;
  status: string;
  raw: unknown;
}

export interface RefundProvider {
  /** Optional, for logging only. */
  readonly name?: string;
  refund(params: RefundParams): Promise<ProviderRefund>;
  getRefund(providerRefundId: string): Promise<ProviderRefund>;
}

export class RefundProviderNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `Refund provider is not configured; missing ${missing.join(", ")}. ` +
        `Set real owner-supplied credentials before executing a live refund.`
    );
    this.name = "RefundProviderNotConfiguredError";
    this.missing = missing;
  }
}

const CONFIRMED_STATUSES = new Set([
  "processed",
  "confirmed",
  "success",
  "succeeded",
  "completed",
  "captured",
]);

/** Only these provider statuses mean money actually moved. */
export function isProviderRefundConfirmed(status: string | undefined | null): boolean {
  return CONFIRMED_STATUSES.has((status || "").trim().toLowerCase());
}

export interface RazorpayRefundConfig {
  keyId: string;
  secret: string;
}

export function razorpayRefundConfigStatus(
  env: NodeJS.ProcessEnv = process.env
): { keyId: string; secret: string; missing: string[]; configured: boolean } {
  const keyId = (env.RAZORPAY_KEY_ID || "").trim();
  const secret = (
    env.RAZORPAY_SECRET ||
    env.RAZORPAY_KEY_SECRET ||
    ""
  ).trim();
  const missing: string[] = [];
  if (!keyId) missing.push("RAZORPAY_KEY_ID");
  if (!secret) missing.push("RAZORPAY_SECRET (or RAZORPAY_KEY_SECRET)");
  return { keyId, secret, missing, configured: missing.length === 0 };
}

/**
 * Sandbox adapter. The refund id is a pure function of the idempotency key, so
 * replaying a request returns the same id and no second "money movement"
 * exists. Suitable for tests and non-production defaults only.
 */
export class TestRefundProvider implements RefundProvider {
  readonly name = "test";
  private readonly refunds = new Map<string, ProviderRefund>();
  /** Recorded calls, so tests can assert "no second provider call". */
  readonly calls: RefundParams[] = [];

  async refund(params: RefundParams): Promise<ProviderRefund> {
    this.calls.push({ ...params });
    const id = `test_refund_${createHash("sha256")
      .update(params.idempotencyKey)
      .digest("hex")
      .slice(0, 16)}`;
    const existing = this.refunds.get(id);
    if (existing) return existing;

    const result: ProviderRefund = {
      providerRefundId: id,
      status: "processed",
      raw: {
        id,
        status: "processed",
        amount: params.amount,
        currency: params.currency ?? "INR",
        idempotency_key: params.idempotencyKey,
        order_id: params.orderId,
        environment: "test",
      },
    };
    this.refunds.set(id, result);
    return result;
  }

  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    return (
      this.refunds.get(providerRefundId) ?? {
        providerRefundId,
        status: "processed",
        raw: { id: providerRefundId, environment: "test" },
      }
    );
  }
}

/** Real adapter. Constructing it without credentials throws — no fake keys. */
export class RazorpayRefundProvider implements RefundProvider {
  readonly name = "razorpay";
  private readonly keyId: string;
  private readonly secret: string;

  constructor(config: RazorpayRefundConfig) {
    const missing: string[] = [];
    if (!config.keyId?.trim()) missing.push("RAZORPAY_KEY_ID");
    if (!config.secret?.trim()) {
      missing.push("RAZORPAY_SECRET (or RAZORPAY_KEY_SECRET)");
    }
    if (missing.length) throw new RefundProviderNotConfiguredError(missing);
    this.keyId = config.keyId.trim();
    this.secret = config.secret.trim();
  }

  private authHeader(): string {
    return (
      "Basic " +
      Buffer.from(`${this.keyId}:${this.secret}`).toString("base64")
    );
  }

  async refund(params: RefundParams): Promise<ProviderRefund> {
    if (!params.paymentId) {
      throw new Error(
        "A payment id is required to create a live Razorpay refund; refusing to guess one."
      );
    }
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        params.paymentId
      )}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader(),
          "Content-Type": "application/json",
          "Idempotency-Key": params.idempotencyKey,
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency ?? "INR",
          notes: {
            order_id: params.orderId,
            refund_request_id: params.refundRequestId ?? "",
          },
        }),
        cache: "no-store",
      }
    );
    if (!response.ok) {
      throw new Error(`Razorpay refund failed with HTTP ${response.status}`);
    }
    const raw = (await response.json()) as Record<string, any>;
    return {
      providerRefundId: String(raw.id ?? ""),
      status: String(raw.status ?? "pending"),
      raw,
    };
  }

  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    const response = await fetch(
      `https://api.razorpay.com/v1/refunds/${encodeURIComponent(
        providerRefundId
      )}`,
      { headers: { Authorization: this.authHeader() }, cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error(`Razorpay refund lookup failed with HTTP ${response.status}`);
    }
    const raw = (await response.json()) as Record<string, any>;
    return {
      providerRefundId: String(raw.id ?? providerRefundId),
      status: String(raw.status ?? "pending"),
      raw,
    };
  }
}

/** Returned in production with no credentials so the failure is loud, not silent. */
class UnconfiguredRefundProvider implements RefundProvider {
  readonly name = "unconfigured";
  constructor(private readonly missing: string[]) {}
  private fail(): never {
    throw new RefundProviderNotConfiguredError(this.missing);
  }
  async refund(): Promise<ProviderRefund> {
    return this.fail();
  }
  async getRefund(): Promise<ProviderRefund> {
    return this.fail();
  }
}

/**
 * Choose the adapter from configuration. Non-production defaults to the test
 * adapter; production without credentials gets a provider that throws rather
 * than accidentally moving (or pretending to move) money.
 */
export function getRefundProvider(
  env: NodeJS.ProcessEnv = process.env
): RefundProvider {
  const config = razorpayRefundConfigStatus(env);
  if (config.configured) {
    return new RazorpayRefundProvider({
      keyId: config.keyId,
      secret: config.secret,
    });
  }
  if ((env.NODE_ENV || "").toLowerCase() === "production") {
    return new UnconfiguredRefundProvider(config.missing);
  }
  return new TestRefundProvider();
}
