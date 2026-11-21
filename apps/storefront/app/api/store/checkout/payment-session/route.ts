/**
 * POST /api/store/checkout/payment-session
 *
 * Prepares a checkout for payment:
 *  1. Initialises a Medusa payment collection/session so the cart can be
 *     converted into an order after payment.
 *  2. Quotes Shiprocket rates for the delivery PIN. The customer's chosen
 *     courier is honoured when it is still serviceable; otherwise we fall back
 *     to the cheapest option so checkout is never blocked.
 *  3. Creates a Razorpay order for cart total + shipping.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { getShippingRates } from "@/lib/shipping/shiprocket";
import { selectShippingRate } from "@/lib/shipping/select-rate";
import { checkoutIsPossible } from "@/lib/config-status";
import { isSold, soldVariantIds } from "@/lib/sold-works";

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || "560001";

type ShippingRate = {
  courier_name: string;
  service_name: string;
  rate: number;
  expected_delivery: string;
  courier_id?: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cart_id, shipping_rate: requestedRate } = body;

    if (!cart_id) {
      return NextResponse.json({ error: "Cart ID required" }, { status: 400 });
    }

    // Refuse before touching the cart, and say what is wrong. A 500 with a
    // generic message at the last step is how a buyer concludes the shop is
    // broken rather than not yet set up.
    if (!checkoutIsPossible()) {
      return NextResponse.json(
        {
          error:
            "This shop cannot take online payments yet. Nothing has been charged — please write to the studio and we will arrange payment directly.",
          code: "payments_unconfigured",
        },
        { status: 503 }
      );
    }

    const cart = await medusa.getCart(cart_id);
    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // A work sold between adding it and paying for it. Refused here as well as in
    // the add action, because a cart can sit for days and the second sale is the
    // one that hurts.
    const sold = await soldVariantIds();
    const soldItem = cart.items.find((item: any) =>
      isSold(sold, item?.variant_id ?? item?.variant?.id)
    );
    if (soldItem) {
      return NextResponse.json(
        {
          error:
            "One of these works has already found its home. Nothing has been charged — please remove it and write to the studio if you would like something similar.",
          code: "work_already_sold",
        },
        { status: 409 }
      );
    }

    // Medusa needs a payment session before the cart can be completed.
    await medusa.ensurePaymentSession(cart_id);

    // Quote shipping for the delivery PIN. Failure here should not block
    // checkout — fall back to free shipping and let the admin reconcile.
    let rates: ShippingRate[] = [];
    const deliveryPostcode =
      cart.shipping_address?.postal_code || cart.billing_address?.postal_code;
    if (deliveryPostcode) {
      const weight = (cart.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 1) * 0.5,
        0
      );
      try {
        rates = await getShippingRates({
          pickup_postcode: PICKUP_POSTCODE,
          delivery_postcode: deliveryPostcode,
          weight: weight || 0.5,
          cod: false,
        });
      } catch (err) {
        console.error("Failed to quote shipping", err);
      }
    }

    // Honour the option the customer picked; only trust a rate that is
    // actually offered for this PIN so the amount cannot be tampered with.
    const chosen = selectShippingRate(rates, requestedRate);
    const shippingAmount = chosen?.rate ?? 0;
    const shippingQuote = chosen
      ? {
          courier_name: chosen.courier_name,
          service_name: chosen.service_name,
          expected_delivery: chosen.expected_delivery,
        }
      : null;

    const RAZORPAY_KEY_ID =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      // Belt and braces: `checkoutIsPossible` already refused above, but this
      // route is reachable directly and must not create a half-session.
      return NextResponse.json(
        {
          error:
            "This shop cannot take online payments yet. Nothing has been charged — please write to the studio and we will arrange payment directly.",
          code: "payments_unconfigured",
        },
        { status: 503 }
      );
    }

    // Guard against a stale cart total of 0 / NaN — Razorpay rejects those and
    // the customer only sees a generic failure.
    const cartTotal = Number(cart.total || 0);
    if (!Number.isFinite(cartTotal) || cartTotal <= 0) {
      return NextResponse.json(
        { error: "Your cart total is zero. Please refresh and try again." },
        { status: 400 }
      );
    }

    const amount = cartTotal + shippingAmount; // minor units (paise)
    const currency = (cart.currency_code || "inr").toUpperCase();

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString(
            "base64"
          ),
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `cart_${cart.id}`,
        notes: {
          cart_id,
          shipping_amount: String(shippingAmount),
          shipping_courier: shippingQuote?.courier_name || "",
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Razorpay order creation failed:", errorText);
      return NextResponse.json(
        { error: "Failed to create Razorpay order" },
        { status: 500 }
      );
    }

    const orderData = await res.json();

    return NextResponse.json({
      razorpay_order_id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      status: orderData.status,
      shipping_amount: shippingAmount,
      shipping: shippingQuote,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create payment session",
      },
      { status: 500 }
    );
  }
}
