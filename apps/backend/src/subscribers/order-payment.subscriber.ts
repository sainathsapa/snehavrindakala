/**
 * Order payment subscriber (plain module).
 *
 * Listens to Medusa payment/order events and triggers fulfilment and
 * notification actions after server-side payment verification.
 */

export const config = {
  event: [
    "order.placed",
    "payment.captured",
    "payment.refunded",
    "order.cancelled",
    "order.fulfilled",
  ],
};

export default async function orderPaymentSubscriber(args: any): Promise<void> {
  const { event, container } = args;
  const eventName = event?.event_name || event?.type || "unknown";
  const data = event?.data || {};
  const id = event?.id || "";

  const paymentModuleService = container.resolve("paymentModuleService");
  const fulfilmentModuleService = container.resolve("fulfilmentModuleService");
  const notificationModuleService = container.resolve("notificationModuleService");
  const integrationEventService = container.resolve("integrationEventModuleService");

  const correlationId = id;

  switch (eventName) {
    case "payment.captured": {
      const { order_id, payment_id, amount } = data || {};
      console.log(
        `[Subscriber] Payment captured: order=${order_id} payment=${payment_id}`
      );

      try {
        await integrationEventService.recordEvent({
          provider: "medusa",
          event_id: correlationId,
          event_type: "payment.captured",
          received_at: new Date(),
          payload: data,
          signature_result: "internal",
          processing_state: "processed",
        });
      } catch (err) {
        console.error("Failed to record payment.captured event", err);
      }

      try {
        const order = await paymentModuleService.retrieveOrder?.(order_id);
        if (order && order.fulfillment_status !== "fulfilled") {
          await fulfilmentModuleService.createFulfillment?.({
            order_id,
            data: { source: "payment_captured" },
          });
        }
      } catch (err) {
        console.error("Fulfilment creation failed", err);
      }

      try {
        await notificationModuleService.sendNotification?.({
          to: data?.customer_email,
          template: "order_confirmation",
          data: { order_id, amount },
        });
      } catch (err) {
        console.error("Order confirmation email failed", err);
      }
      break;
    }

    case "payment.refunded": {
      const { order_id, amount, reason } = data || {};
      console.log(
        `[Subscriber] Payment refunded: order=${order_id} amount=${amount}`
      );

      try {
        const auditService = container.resolve("auditModuleService");
        await auditService.record({
          actor: "system",
          actor_role: "system",
          action: "order_refunded",
          entity: "order",
          entity_id: order_id,
          before: null,
          after: { amount, reason },
          request_correlation_id: correlationId,
        });
      } catch (err) {
        console.error("Refund audit record failed", err);
      }

      try {
        await notificationModuleService.sendNotification?.({
          to: data?.customer_email,
          template: "refund_processed",
          data: { order_id, amount, reason },
        });
      } catch (err) {
        console.error("Refund notification failed", err);
      }
      break;
    }

    case "order.cancelled": {
      const { order_id } = data || {};
      console.log(`[Subscriber] Order cancelled: order=${order_id}`);

      try {
        await fulfilmentModuleService.cancelFulfillment?.({ order_id });
      } catch (err) {
        console.error("Fulfilment cancellation failed", err);
      }
      break;
    }

    case "order.fulfilled": {
      const { order_id, tracking_number } = data || {};
      console.log(
        `[Subscriber] Order fulfilled: order=${order_id} tracking=${tracking_number}`
      );

      try {
        await notificationModuleService.sendNotification?.({
          to: data?.customer_email,
          template: "shipment_confirmed",
          data: { order_id, tracking_number },
        });
      } catch (err) {
        console.error("Shipment confirmation failed", err);
      }
      break;
    }

    default:
      console.log(`[Subscriber] Unhandled event: ${eventName}`);
  }
}
