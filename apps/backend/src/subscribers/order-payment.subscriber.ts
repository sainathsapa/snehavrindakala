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

  const paymentModuleService = container.resolve("payment");
  const fulfilmentModuleService = container.resolve("fulfillment");
  const notificationModuleService = container.resolve("notification");
  const integrationEventService = container.resolve("integration_event");

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

      // Fetch the order once, up front: fulfilment needs it and so does the
      // confirmation email. Previously the email fired with only an order id
      // and an amount, so the customer received a receipt with no items,
      // no address and no way to act on it.
      let order: any = null;
      try {
        order = await paymentModuleService.retrieveOrder?.(order_id);
      } catch (err) {
        console.error("Failed to retrieve order for confirmation", err);
      }

      try {
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
          to: order?.email || data?.customer_email,
          template: "order_confirmation",
          data: {
            order_id,
            amount,
            order: order
              ? {
                  id: order.id,
                  display_id: order.display_id,
                  email: order.email,
                  currency_code: order.currency_code,
                  total: order.total,
                  subtotal: order.subtotal,
                  shipping_total: order.shipping_total,
                  items: (order.items || []).map((item: any) => ({
                    title: item.title || item.product_title,
                    variant_title: item.variant_title,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total: item.total,
                  })),
                  shipping_address: order.shipping_address || null,
                }
              : undefined,
          },
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
        const auditService = container.resolve("audit");
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
          to: data?.customer_email || data?.email,
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
        let shipmentOrder: any = null;
        try {
          shipmentOrder = await paymentModuleService.retrieveOrder?.(order_id);
        } catch (err) {
          console.error("Failed to retrieve order for shipment email", err);
        }

        await notificationModuleService.sendNotification?.({
          to: data?.customer_email || shipmentOrder?.email,
          template: "shipment_confirmed",
          data: {
            order_id,
            tracking_number,
            awb_code: data?.awb_code,
            courier_name: data?.courier_name,
          },
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
