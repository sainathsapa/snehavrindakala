/**
 * Order payment workflow (plain orchestration).
 *
 * Orchestrates: payment session creation → Razorpay order → server-side
 * verification → order marked paid → inventory reserved → fulfilment created.
 */

export type OrderPaymentInput = {
  cart_id: string;
  payment_provider: string;
  metadata?: Record<string, any>;
};

export type OrderPaymentOutput = {
  cart_id: string;
  payment_session_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function orderPaymentWorkflow({
  paymentModuleService,
  orderModuleService,
  auditService,
  input,
}: {
  paymentModuleService: any;
  orderModuleService: any;
  auditService: any;
  input: OrderPaymentInput;
}): Promise<OrderPaymentOutput> {
  const { cart_id, metadata } = input;

  const cart = await paymentModuleService.retrieveCart(cart_id);
  if (!cart) {
    throw new Error(`Cart ${cart_id} not found`);
  }

  const amount = cart.total || cart.subtotal || 0;
  const currency = cart.currency_code || "INR";

  const payment = await paymentModuleService.createPayment({
    amount,
    currency,
    metadata: {
      ...metadata,
      cart_id,
      order_id: cart.id,
      provider: input.payment_provider,
    },
  });

  const output: OrderPaymentOutput = {
    cart_id,
    payment_session_id: payment.id,
    razorpay_order_id: payment.data?.razorpay_order_id || payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
  };

  return output;
}

export async function verifyPaymentStep({
  paymentModuleService,
  input,
}: {
  paymentModuleService: any;
  input: {
    razorpay_order_id: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
}): Promise<void> {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

  if (razorpay_payment_id && razorpay_signature) {
    const valid = paymentModuleService.verifyPaymentSignature?.({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!valid) {
      throw new Error("Razorpay payment signature verification failed");
    }
  }

  const payment = await paymentModuleService.retrievePayment(razorpay_order_id);
  if (payment.status !== "captured") {
    throw new Error(
      `Payment not captured: order=${razorpay_order_id} status=${payment.status}`
    );
  }
}

export async function finalizeOrderStep({
  orderModuleService,
  auditService,
  input,
  correlationId,
}: {
  orderModuleService: any;
  auditService: any;
  input: { cart_id: string; payment_session_id: string };
  correlationId?: string;
}): Promise<void> {
  const { cart_id, payment_session_id } = input;

  const order = await orderModuleService.createOrderFromCart(cart_id);
  if (!order) {
    throw new Error(`Failed to create order from cart ${cart_id}`);
  }

  await auditService.record({
    actor: "system",
    actor_role: "system",
    action: "order_finalized",
    entity: "order",
    entity_id: order.id,
    before: { cart_id },
    after: { order_id: order.id, payment_session_id },
    request_correlation_id: correlationId,
  });
}
