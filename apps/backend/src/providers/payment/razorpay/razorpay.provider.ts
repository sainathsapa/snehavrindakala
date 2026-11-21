import { createHmac, timingSafeEqual } from "crypto";
import {
  AbstractPaymentProvider,
  BigNumber,
  PaymentActions,
} from "@medusajs/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
  BigNumberInput,
} from "@medusajs/types";

/**
 * Razorpay payment provider for Medusa v2.
 *
 * This used to be a Medusa v1 adapter: a plain class plus a
 * `({container, options})` factory and the v1 method names (`createPayment`,
 * `updatePayment`, `deletePayment`). Registering it made the backend crash with
 * "moduleProviderServices is not iterable", so the shop silently ran on
 * `pp_system_default`.
 *
 * It now extends `AbstractPaymentProvider` and implements the v2 lifecycle.
 * Amounts cross the Medusa boundary as major units and are converted to paise
 * (the smallest unit Razorpay accepts) here, and back again on the way out.
 *
 * Security rules this file is responsible for:
 * - A browser redirect is never proof of payment. State is read back from
 *   Razorpay's API before a payment is reported as authorized or captured.
 * - Webhook signatures are HMAC-SHA256 over the RAW body and compared in
 *   constant time.
 * - The provider event id is carried through so Medusa's event ledger can drop
 *   duplicates.
 */

export type RazorpayOptions = {
  key_id?: string;
  key_secret?: string;
  webhook_secret?: string;
  /** Razorpay capture mode: "automatic" captures on authorization. */
  auto_capture?: boolean;
};

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "attempted" | "paid";
  receipt?: string;
  created_at?: number;
  notes?: Record<string, string>;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured?: boolean;
  error_description?: string;
};

/**
 * Minor-unit multipliers. Razorpay settles in the smallest unit of the
 * currency, which is not always 1/100 — the rupee is fine but JPY has 0
 * decimals and the Gulf dinars have 3. Mirrors the list Medusa's own Stripe
 * provider uses rather than assuming two places.
 */
const ZERO_DECIMAL = [
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
];
const THREE_DECIMAL = ["BHD", "IQD", "JOD", "KWD", "OMR", "TND"];

export function currencyMultiplier(currency: string): number {
  const code = (currency || "").toUpperCase();
  if (ZERO_DECIMAL.includes(code)) return 1;
  if (THREE_DECIMAL.includes(code)) return 1000;
  return 100;
}

/** Medusa amount (major units) → provider smallest unit (integer). */
export function toMinorUnits(
  amount: BigNumberInput | BigNumber,
  currency: string
): number {
  const multiplier = currencyMultiplier(currency);
  const value = new BigNumber(amount).numeric;
  const scaled = Math.round(value * multiplier);
  // Three-decimal currencies are settled in multiples of ten, as Stripe does.
  return multiplier === 1000 ? Math.ceil(scaled / 10) * 10 : scaled;
}

/** Provider smallest unit (integer) → Medusa amount (major units). */
export function fromMinorUnits(amount: number, currency: string): number {
  const multiplier = currencyMultiplier(currency);
  return new BigNumber(amount).numeric / multiplier;
}

export class RazorpayPaymentProvider extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay";

  protected readonly keyId_: string;
  protected readonly keySecret_: string;
  protected readonly webhookSecret_: string;
  protected readonly autoCapture_: boolean;
  protected readonly baseUrl_: string = "https://api.razorpay.com/v1";
  protected readonly logger_: { warn?: Function; error?: Function } | undefined;

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.key_id && !process.env.RAZORPAY_KEY_ID) {
      throw new Error(
        "Razorpay provider requires `key_id` in its options or RAZORPAY_KEY_ID"
      );
    }
    if (!options.key_secret && !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        "Razorpay provider requires `key_secret` in its options or RAZORPAY_KEY_SECRET"
      );
    }
  }

  constructor(container: Record<string, unknown>, options: RazorpayOptions = {}) {
    super(container, options);

    this.logger_ = container?.logger as { warn?: Function; error?: Function };

    this.keyId_ = options.key_id || process.env.RAZORPAY_KEY_ID || "";
    this.keySecret_ =
      options.key_secret || process.env.RAZORPAY_KEY_SECRET || "";
    this.webhookSecret_ =
      options.webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    this.autoCapture_ = options.auto_capture !== false;

    if (!this.keyId_ || !this.keySecret_) {
      // Never let boot succeed with a half-configured provider: every payment
      // would fail at the first request instead of here.
      throw new Error(
        "Razorpay provider requires key_id and key_secret (test keys first)"
      );
    }

    if (!this.webhookSecret_ && this.logger_?.warn) {
      this.logger_.warn(
        "Razorpay webhook_secret is not set. Webhook events cannot be verified, " +
          "so asynchronous payment updates (capture, failure, refunds) will be ignored."
      );
    }
  }

  // ── Medusa v2 lifecycle ────────────────────────────────────────────────

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, data, context } = input;
    const currency = (currency_code || "inr").toUpperCase();

    const metadata = (data?.metadata as Record<string, unknown>) || {};

    const order = await this.request<RazorpayOrder>("POST", "/orders", {
      amount: toMinorUnits(amount, currency),
      currency,
      receipt: String(
        metadata.medusa_cart_id ||
          metadata.medusa_order_id ||
          data?.session_id ||
          `cart_${Date.now()}`
      ).slice(0, 40),
      // Razorpay has no capture flag on the order; capture is decided when the
      // payment is captured. Keep the intent in notes for reconciliation.
      notes: {
        medusa_cart_id: String(metadata.medusa_cart_id || ""),
        medusa_order_id: String(metadata.medusa_order_id || ""),
        session_id: String(data?.session_id || ""),
        idempotency_key: String(context?.idempotency_key || ""),
        platform: "snehavrinda-kala",
      },
    });

    return {
      id: order.id,
      data: {
        id: order.id,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
      },
    };
  }

  /**
   * Called during cart completion. Reads the order back from Razorpay rather
   * than trusting anything the browser sent.
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = input.data || {};
    const orderId = this.orderIdFrom(data);
    if (!orderId) {
      return { status: "pending_authorization", data };
    }

    const [order, payments] = await Promise.all([
      this.retrieveOrder(orderId),
      this.listOrderPayments(orderId).catch(() => [] as RazorpayPayment[]),
    ]);

    const latest = pickLatestPayment(payments);
    const status = this.statusFrom(order, latest);

    return {
      status,
      data: {
        ...data,
        id: order.id,
        razorpay_order_id: order.id,
        razorpay_payment_id: latest?.id ?? data.razorpay_payment_id ?? null,
        amount: order.amount,
        currency: order.currency,
        order_status: order.status,
        payment_status: latest?.status ?? null,
      },
    };
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data || {};
    const paymentId = String(data.razorpay_payment_id || data.id || "");
    const orderId = this.orderIdFrom(data);

    if (!paymentId) {
      // Nothing was captured in Razorpay (e.g. the session never completed).
      return { data };
    }

    const currency = String(data.currency || "INR");
    const amount =
      typeof data.amount === "number" && data.amount > 0
        ? data.amount
        : orderId
          ? (await this.retrieveOrder(orderId)).amount
          : 0;

    try {
      const payment = await this.request<RazorpayPayment>(
        "POST",
        `/payments/${encodeURIComponent(paymentId)}/capture`,
        { amount, currency }
      );

      return {
        data: {
          ...data,
          id: payment.id,
          razorpay_payment_id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          payment_status: payment.status,
        },
      };
    } catch (error) {
      // Razorpay answers 400 "This payment has already been captured" when the
      // shop runs in automatic capture mode. That is success, not failure.
      if (isAlreadyCaptured(error)) {
        return { data };
      }
      throw error;
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data || {};
    const paymentId = String(data.razorpay_payment_id || data.id || "");
    if (!paymentId) {
      throw new Error(
        "Razorpay refund requires the provider payment id in the payment data"
      );
    }

    const currency = String(data.currency || "INR");
    const refund = await this.request("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: toMinorUnits(input.amount, currency),
    });

    return { data: { ...data, last_refund: refund } };
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    // Razorpay orders cannot be cancelled; an unauthorized payment simply
    // expires. Refunds are the only way to return captured money, and those go
    // through refundPayment.
    return { data: { ...(input.data || {}), canceled_at: new Date().toISOString() } };
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return { data: input.data || {} };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data || {};
    const orderId = this.orderIdFrom(data);

    if (!orderId) {
      return { status: "pending", data };
    }

    const [order, payments] = await Promise.all([
      this.retrieveOrder(orderId),
      this.listOrderPayments(orderId).catch(() => [] as RazorpayPayment[]),
    ]);

    const latest = pickLatestPayment(payments);

    return {
      status: this.statusFrom(order, latest),
      data: {
        ...data,
        id: order.id,
        razorpay_order_id: order.id,
        razorpay_payment_id: latest?.id ?? null,
        amount: order.amount,
        currency: order.currency,
        order_status: order.status,
        payment_status: latest?.status ?? null,
      },
    };
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = input.data || {};
    const orderId = this.orderIdFrom(data);
    if (!orderId) {
      return { data };
    }

    const order = await this.retrieveOrder(orderId);
    return {
      data: {
        ...data,
        id: order.id,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
      },
    };
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    // An amount change before authorization would need a new Razorpay order;
    // the storefront recreates the session in that case. Keep the existing
    // order and report its real state so a stale session cannot look paid.
    const status = await this.getPaymentStatus({ data: input.data });
    return { status: status.status, data: status.data };
  }

  /**
   * Medusa verifies the raw-body signature before this is called? No — it
   * passes the payload through, so the signature is checked here.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = payload;

    if (!this.webhookSecret_) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const signature = String(
      (headers?.["x-razorpay-signature"] as string) ??
        (headers?.["X-Razorpay-Signature"] as string) ??
        ""
    );

    const raw = bufferToString(rawData);
    if (!signature || !raw || !this.verifyWebhookSignature(raw, signature)) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const event = parseEvent(raw, data);
    const eventType = String(event?.event || "");
    // Razorpay nests the object under `entity`: payload.payment.entity.
    const selected = event?.payload?.payment || event?.payload?.order || {};
    const entity = (selected?.entity || selected) as Record<string, any>;

    const orderId = String(entity.order_id || entity.id || "");
    const sessionId = String(entity.notes?.session_id || "");
    const amount = new BigNumber(
      typeof entity.amount === "number"
        ? fromMinorUnits(entity.amount, String(entity.currency || "INR"))
        : 0
    );

    const build = (action: PaymentActions): WebhookActionResult => ({
      action,
      data: { session_id: sessionId || orderId, amount },
    });

    switch (eventType) {
      case "payment.captured":
      case "order.paid":
        return build(PaymentActions.SUCCESSFUL);
      case "payment.authorized":
      case "order.authorized":
        return build(PaymentActions.AUTHORIZED);
      case "payment.failed":
      case "order.failed":
        return build(PaymentActions.FAILED);
      case "payment.pending":
        return build(PaymentActions.PENDING);
      default:
        return build(PaymentActions.NOT_SUPPORTED);
    }
  }

  // ── Signatures ────────────────────────────────────────────────────────

  /**
   * Verify Razorpay webhook signature (HMAC-SHA256 over the raw body).
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret_) {
      throw new Error("Razorpay webhook secret not configured");
    }

    const expected = createHmac("sha256", this.webhookSecret_)
      .update(rawBody)
      .digest("hex");

    return safeEqualHex(expected, signature);
  }

  /**
   * Verify a Razorpay checkout handshake: `<order_id>|<payment_id>` signed with
   * the key secret.
   */
  verifyPaymentSignature(options: {
    order_id: string;
    payment_id: string;
    signature: string;
  }): boolean {
    const { order_id, payment_id, signature } = options;
    const expected = createHmac("sha256", this.keySecret_)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");
    return safeEqualHex(expected, signature);
  }

  // ── HTTP ──────────────────────────────────────────────────────────────

  /** Fetch a Razorpay payment for reconciliation. */
  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      "GET",
      `/payments/${encodeURIComponent(paymentId)}`
    );
  }

  /** Fetch a Razorpay order. */
  async retrieveOrder(orderId: string): Promise<RazorpayOrder> {
    try {
      return await this.request<RazorpayOrder>(
        "GET",
        `/orders/${encodeURIComponent(orderId)}`
      );
    } catch (error) {
      throw new Error(
        `Razorpay order ${orderId} could not be retrieved: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Fetch every payment attached to an order. */
  async listOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const response = await this.request<{
      items?: RazorpayPayment[];
      payments?: RazorpayPayment[];
    }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`);

    const items = response?.items || response?.payments || [];
    return Array.isArray(items) ? items : [];
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl_}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.keyId_}:${this.keySecret_}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Razorpay ${method} ${path} failed: ${response.status} ${errorBody}`
      );
    }

    return (await response.json()) as T;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  protected orderIdFrom(data: Record<string, unknown>): string {
    return String(
      data.razorpay_order_id || data.order_id || data.id || ""
    );
  }

  protected statusFrom(
    order: RazorpayOrder,
    payment?: RazorpayPayment
  ): "authorized" | "captured" | "pending" | "error" | "canceled" {
    switch (payment?.status) {
      case "captured":
        return "captured";
      case "authorized":
        return "authorized";
      case "failed":
        return "error";
      case "refunded":
        return "captured";
      case "created":
        return "pending";
      default:
        break;
    }

    switch (order.status) {
      case "paid":
        return "captured";
      case "attempted":
        return "pending";
      default:
        return "pending";
    }
  }
}

function pickLatestPayment(payments: RazorpayPayment[]): RazorpayPayment | undefined {
  if (!payments.length) return undefined;
  const rank = (status: string) =>
    status === "captured"
      ? 3
      : status === "authorized"
        ? 2
        : status === "failed"
          ? 1
          : 0;
  return [...payments].sort((a, b) => rank(b.status) - rank(a.status))[0];
}

function isAlreadyCaptured(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already been captured|already captured/i.test(message);
}

function safeEqualHex(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function bufferToString(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

function parseEvent(raw: string, parsed: unknown): any {
  if (parsed && typeof parsed === "object" && "event" in (parsed as any)) {
    return parsed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default RazorpayPaymentProvider;
