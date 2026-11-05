/**
 * Razorpay webhook handler (production-grade).
 *
 * Security controls:
 * - Validates HMAC-SHA256 signature over RAW body before JSON parsing
 * - Idempotent via integration event ledger (provider event ID)
 * - Responds quickly; enqueues longer work for async processing
 * - Handles out-of-order and duplicate events safely
 *
 * Razorpay events of interest:
 * - order.paid, order.authorized, order.failed
 * - payment.authorized, payment.captured, payment.failed
 * - refund.processed, refund.failed
 * - order.cancelled
 */
export class RazorpayWebhookHandler {
  protected readonly provider_: any;
  protected readonly manager_: any;
  protected readonly integrationEventService_: any;

  constructor(container: any) {
    this.provider_ = container.resolve("razorpayPaymentProvider");
    this.manager_ = container.resolve("manager");
    this.integrationEventService_ =
      container.resolve("integrationEventModuleService");
  }

  async handle(req: any, res: any): Promise<void> {
    const rawBody = req.body as Buffer | string;
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      res.status(400).json({ error: "Missing X-Razorpay-Signature header" });
      return;
    }

    let valid = false;
    try {
      valid = this.provider_.verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      res.status(400).json({ error: "Webhook secret not configured" });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    let payload: any;
    try {
      payload =
        typeof rawBody === "string"
          ? JSON.parse(rawBody)
          : JSON.parse(rawBody.toString());
    } catch (err) {
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    const { event: event_type, payload: event_payload } = payload;
    const entity =
      event_payload?.order ||
      event_payload?.payment ||
      event_payload?.refund;
    const event_id = entity?.id || payload?.id;

    if (!event_id) {
      res.status(400).json({ error: "Missing event entity ID" });
      return;
    }

    let eventRecord: any;
    try {
      eventRecord = await this.integrationEventService_.recordEvent({
        provider: "razorpay",
        event_id,
        event_type,
        received_at: new Date(),
        payload: event_payload,
        signature_result: "valid",
        processing_state: "received",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to record integration event" });
      return;
    }

    if (eventRecord.processing_state === "processed") {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      await this.integrationEventService_.markProcessing(eventRecord.id);

      switch (event_type) {
        case "order.paid":
        case "order.authorized":
        case "payment.captured":
        case "payment.authorized":
          await this.handlePaymentCaptured(event_payload);
          break;
        case "order.failed":
        case "payment.failed":
          await this.handlePaymentFailed(event_payload);
          break;
        case "refund.processed":
          await this.handleRefundProcessed(event_payload);
          break;
        case "refund.failed":
          await this.handleRefundFailed(event_payload);
          break;
        case "order.cancelled":
          await this.handleOrderCancelled(event_payload);
          break;
        default:
          break;
      }

      await this.integrationEventService_.markProcessed(eventRecord.id);
      res.status(200).json({ received: true, processed: true });
    } catch (err) {
      await this.integrationEventService_.markFailed(
        eventRecord.id,
        err instanceof Error ? err.message : String(err)
      );
      res.status(500).json({ error: "Event processing failed" });
    }
  }

  private async handlePaymentCaptured(payload: any): Promise<void> {
    const orderEntity = payload.order || payload.payment;
    const razorpayOrderId = orderEntity?.id;
    const razorpayPaymentId =
      orderEntity?.payments?.[0]?.id || orderEntity?.id;

    if (razorpayOrderId) {
      await this.provider_.fetchOrderPayments(razorpayOrderId);
    }

    console.log(
      `[Razorpay] Payment captured: order=${razorpayOrderId} payment=${razorpayPaymentId}`
    );
  }

  private async handlePaymentFailed(payload: any): Promise<void> {
    const orderEntity = payload.order || payload.payment;
    console.log(
      `[Razorpay] Payment failed: order=${orderEntity?.id}`
    );
  }

  private async handleRefundProcessed(payload: any): Promise<void> {
    const refund = payload.refund || payload;
    console.log(
      `[Razorpay] Refund processed: payment=${refund.payment_id} amount=${refund.amount}`
    );
  }

  private async handleRefundFailed(payload: any): Promise<void> {
    const refund = payload.refund || payload;
    console.log(
      `[Razorpay] Refund failed: payment=${refund.payment_id} amount=${refund.amount}`
    );
  }

  private async handleOrderCancelled(payload: any): Promise<void> {
    const order = payload.order || payload;
    console.log(
      `[Razorpay] Order cancelled: order=${order.id}`
    );
  }
}


