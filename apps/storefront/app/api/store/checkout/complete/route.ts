/**
 * POST /api/store/checkout/complete
 *
 * Converts a paid cart into an order and creates the Shiprocket shipment.
 *
 * The client sends the Razorpay handshake (`razorpay_order_id`,
 * `razorpay_payment_id`, `razorpay_signature`). The signature is verified with
 * HMAC-SHA256 against RAZORPAY_KEY_SECRET — without it anyone could POST a made
 * up payment id and receive a free order. When the signature is missing we fall
 * back to asking Razorpay for the payment and checking that it is captured and
 * that its order id matches the cart we are about to complete.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { medusa } from "@/lib/medusa";
import { CART_COOKIE } from "@/lib/cart";
import { getAdminOrder } from "@/lib/admin";
import { createShipmentForOrder } from "@/lib/shipping/create-order-shipment";
import { issueOrderToken } from "@/lib/order-token";
import { issueCertificatesForOrder } from "@/lib/certificates";
import { saveGiftForOrder } from "@/lib/gift";
import { sendOrderConfirmation } from "@/lib/email";
import { ensureAccountForGuestOrder, type GuestAccountResult } from "@/lib/guest-account";
import { AUTH_COOKIE } from "@/lib/auth";
import { isSold, soldVariantIds } from "@/lib/sold-works";
import {
  consumeReservation,
  linkReservationsToOrder,
} from "@/lib/inventory";
import { checkoutProvider } from "@/lib/payment-provider";
import { claimPayment, releasePaymentClaim } from "@/lib/payment-guard";

const RAZORPAY_KEY_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function razorpayAuth(): string {
  return (
    "Basic " +
    Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")
  );
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cart_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Kept for backwards compatibility with the older client payload.
      payment_id,
    } = body;

    const paymentId = razorpay_payment_id || payment_id;

    // The signature and the Razorpay order id are MANDATORY. An earlier version
    // only checked them when the client happened to send them, which let anyone
    // attach an unrelated captured payment to their own cart by omitting both.
    if (!cart_id || !paymentId || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error:
            "Cart ID, payment ID, Razorpay order ID and signature are all required.",
        },
        { status: 400 }
      );
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Payments are not configured for this environment." },
        { status: 500 }
      );
    }

    const cart = await medusa.getCart(cart_id);
    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Last line of defence, after the money has moved but before the order is
    // created. If a second buyer paid for a work that was already sold, the right
    // thing is a refund and a conversation, not two certificates for one piece —
    // so this refuses, and the buyer is told nothing has been charged *for this
    // order* and to write to the studio.
    const soldElsewhere = await soldVariantIds();
    const clash = cart.items.find((item: any) =>
      isSold(soldElsewhere, item?.variant_id ?? item?.variant?.id)
    );
    if (clash) {
      return NextResponse.json(
        {
          error:
            "This work was sold a moment before your payment. Please write to the studio with your payment ID — a refund is raised and we will find you something comparable.",
          code: "work_already_sold",
          payment_id: paymentId,
        },
        { status: 409 }
      );
    }

    if (!verifySignature(razorpay_order_id, paymentId, razorpay_signature)) {
      return NextResponse.json(
        { error: "Payment signature verification failed" },
        { status: 400 }
      );
    }

    // Ask Razorpay directly as well: signature checks the handshake, this
    // confirms the money actually moved and belongs to this checkout.
    const paymentRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: razorpayAuth() },
        cache: "no-store",
      }
    );

    if (!paymentRes.ok) {
      return NextResponse.json(
        { error: "Payment could not be verified" },
        { status: 400 }
      );
    }

    const payment = await paymentRes.json();
    // Only a captured payment counts. "authorized" is not money in the account
    // and accepting it let an order be created against a payment that could
    // never be captured.
    if (payment.status !== "captured") {
      return NextResponse.json(
        { error: "Payment has not been captured" },
        { status: 400 }
      );
    }

    // HMAC already binds this pair to our secret; also confirm Razorpay's own
    // record agrees, unconditionally rather than only when the client supplied
    // a matching order id.
    if (!payment.order_id || payment.order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Payment does not belong to this checkout" },
        { status: 400 }
      );
    }

    if (Number(payment.amount) < Number(cart.total || 0)) {
      return NextResponse.json(
        { error: "Payment amount does not match the cart" },
        { status: 400 }
      );
    }

    // Payment is verified: now, and only now, convert the holds into sales inside
    // the same row lock that guards stock. For a legacy cart with no hold,
    // consumeReservation reserves-and-consumes atomically, so two concurrent
    // completions of a one-of-one work cannot both succeed. Untracked variants
    // return `tracked:false` and keep the previous behaviour.
    const consumedReservationIds: string[] = [];
    for (const item of cart.items) {
      const line = item as Record<string, any>;
      const variantId = line?.variant_id ?? line?.variant?.id;
      if (!variantId) continue;
      const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
      const consumed = await consumeReservation({
        variantId,
        cartId: cart_id,
        orderId: `pending:${paymentId}`,
        quantity,
      });
      if (!consumed.ok) {
        return NextResponse.json(
          {
            error:
              "This work was bought by another customer while you were paying. Your payment has NOT been used for an order — please contact the studio with your payment ID for a refund.",
            code: "work_already_sold",
            payment_id: paymentId,
          },
          { status: 409 }
        );
      }
      if (consumed.reservationId) consumedReservationIds.push(consumed.reservationId);
    }

    // Single-use claim: the same verified payment must never create two orders.
    // Atomic ON CONFLICT DO NOTHING makes concurrent replays safe.
    const claimed = await claimPayment({
      paymentId,
      cartId: cart_id,
      razorpayOrderId: razorpay_order_id,
    });
    if (!claimed) {
      return NextResponse.json(
        {
          error:
            "This payment has already been used for an order. If you were charged twice, contact the studio with this payment ID.",
          code: "payment_already_used",
        },
        { status: 409 }
      );
    }

    // Medusa refuses to complete a cart with shippable items and no shipping
    // method. Checkout charges a Shiprocket quote but never registered a method,
    // so every paid order failed here after the money was taken.
    try {
      await medusa.ensureShippingMethod(cart_id);
    } catch (err) {
      console.error("Failed to attach shipping method:", err);
    }

    // Make completion resilient: if the payment session was not created for
    // any reason, initialise it now so Medusa can convert the cart. The same
    // provider id as the session route is used, otherwise this would add a
    // second session on the other provider and completion would pick the wrong
    // one — the kind of mistake that only shows up as a duplicate charge.
    const provider = checkoutProvider();
    try {
      await medusa.ensurePaymentSession(cart_id, provider.providerId);
    } catch (err) {
      console.error("Failed to ensure payment session:", err);
    }

    let order;
    try {
      order = await medusa.completeOrder(cart_id);
    } catch (err) {
      // Completion failed after the money moved. Free the claim so a genuine
      // retry is possible; the payment is untouched and must be reconciled.
      await releasePaymentClaim(paymentId).catch((releaseErr) =>
        console.error("Could not release payment claim", releaseErr)
      );
      throw err;
    }
    await linkReservationsToOrder(consumedReservationIds, order.id).catch((err) =>
      console.error("Could not link stock reservations to order", order.id, err)
    );

    let shipment: any = null;
    let shippingError: string | null = null;
    let fullOrder: any = order;
    try {
      const result = await getAdminOrder(order.id);
      fullOrder = result.order;
      shipment = await createShipmentForOrder(result.order);
    } catch (err) {
      console.error("Shipment creation failed:", err);
      shippingError =
        err instanceof Error
          ? err.message
          : "Shipment could not be created. You can retry from the admin panel.";
    }

    // Certificates of authenticity. Non-fatal on purpose: the sale is already
    // complete, and a paperwork failure must not turn a paid order into an
    // error page. Reissued from the order if it fails here.
    let certificates: Awaited<ReturnType<typeof issueCertificatesForOrder>> = [];
    try {
      certificates = await issueCertificatesForOrder(fullOrder as never);
    } catch (err) {
      console.error("Could not issue certificates of authenticity:", err);
    }

    // The gift note was written onto the cart before payment, so it survives a
    // closed tab. Copying it onto the order is what the packing bench reads.
    try {
      await saveGiftForOrder(
        order.id,
        cart.metadata?.gift_note,
        cart.metadata?.gift_wrap
      );
    } catch (err) {
      console.error("Could not record the gift note:", err);
    }

    // Send the confirmation from here as well as from the Medusa subscriber.
    // Guest checkout is the common path and must not depend on an event that
    // may fire later, or not at all if the order was already marked paid.
    let confirmationSent = false;
    try {
      confirmationSent = await sendOrderConfirmation(fullOrder);
    } catch (err) {
      console.error("Order confirmation email failed:", err);
    }

    // A guest has just paid and has no way back in. Create their account and
    // mail the order details plus the invoice, with a temporary password and a
    // one-click set-your-own-password link. Never fatal: the order is paid.
    let guestAccount: GuestAccountResult | null = null;
    try {
      const jar = await cookies();
      const signedIn = Boolean(jar.get(AUTH_COOKIE)?.value);
      guestAccount = await ensureAccountForGuestOrder(fullOrder as never, {
        signedIn,
      });

      // Sign the new account in on this browser. The customer just proved they
      // own the inbox by paying for the order; asking them to retype the
      // temporary password we mailed a second ago is friction with no security
      // value. The password stays valid for them to use elsewhere.
      if (guestAccount.outcome === "created" && guestAccount.password && fullOrder?.email) {
        try {
          const session = await medusa.loginCustomer(
            String(fullOrder.email),
            guestAccount.password
          );
          jar.set(AUTH_COOKIE, session.token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        } catch (err) {
          console.error("Could not sign the new guest account in:", err);
        }
      }
    } catch (err) {
      console.error("Guest account provisioning failed:", err);
    }

    // A guest has no session, so give them a signed link to their own order.
    // This is what lets the confirmation page work without exposing the order
    // to anyone who guesses an id.
    const orderToken = issueOrderToken(order.id);

    // The cart is finished, so forget it.
    //
    // The cart cookie outlived the order. `getCart` only returns null when
    // Medusa throws, and a completed cart still answers reads for a while, so
    // the buyer paid, landed on the confirmation page, and then found the same
    // items still in the cart. Clearing the id here is what makes the cart
    // empty the moment the order exists.
    try {
      const jar = await cookies();
      jar.delete(CART_COOKIE);
    } catch (err) {
      // A cookie write can fail outside a request scope; the order is already
      // placed, and failing the response over a stale cookie would be worse
      // than leaving it.
      console.error("Could not clear the cart cookie after checkout:", err);
    }

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
      order_token: orderToken,
      certificates: certificates.map((certificate) => ({
        code: certificate.code,
        title: certificate.title,
        url: `/verify/${certificate.code}`,
      })),
      confirmation_email_sent: confirmationSent,
      shipment,
      shipping_error: shippingError,
    });
  } catch (err) {
    // Medusa's client embeds the request path and status in its message
    // ("Medusa API request failed: 404 /store/carts/cart_x"). Returning that
    // verbatim hands an unauthenticated caller a map of the backend, so it is
    // logged and replaced with a sentence the buyer can act on.
    console.error("Checkout completion failed", err);
    return NextResponse.json(
      {
        error:
          "We could not complete your order. Please try again, or contact us if the payment was taken.",
      },
      { status: 500 }
    );
  }
}
