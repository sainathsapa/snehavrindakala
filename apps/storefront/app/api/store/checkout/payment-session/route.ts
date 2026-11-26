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
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { medusa } from "@/lib/medusa";
import { getShippingRates } from "@/lib/shipping/shiprocket";
import { selectShippingRate } from "@/lib/shipping/select-rate";
import { checkoutIsPossible } from "@/lib/config-status";
import { isSold, soldVariantIds } from "@/lib/sold-works";
import { reserveStock } from "@/lib/inventory";
import { RAZORPAY_PROVIDER, checkoutProvider } from "@/lib/payment-provider";

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || "560001";

type ShippingRate = {
  courier_name: string;
  service_name: string;
  rate: number;
  expected_delivery: string;
  courier_id?: number;
};

export async function POST(req: Request) {
  // Public endpoint: bound it per IP so one caller cannot use it as a free
  // proxy for our own costs (courier quotes, payment orders, file uploads).
  const limit = await checkRateLimit({
    route: "payment-session",
    ip: clientIp(req.headers),
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

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

    // Atomic reservation. For owner-initialised (tracked) variants this is the
    // first half of the double-sale fix: two buyers asking for a one-of-one at
    // the same instant are serialised by a row lock and only one gets a hold.
    // Untracked variants are left to the legacy sold-works guard above.
    for (const item of cart.items) {
      const line = item as Record<string, any>;
      const variantId = line?.variant_id ?? line?.variant?.id;
      if (!variantId) continue;
      const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
      const held = await reserveStock({ variantId, cartId: cart_id, quantity });
      if (!held.ok) {
        return NextResponse.json(
          {
            error:
              "This work was reserved by another buyer just now. Nothing has been charged — please refresh and choose another piece.",
            code: "work_already_sold",
          },
          { status: 409 }
        );
      }
    }

    // Medusa needs a payment session before the cart can be completed. Which
    // provider owns that session decides who creates the Razorpay order: this
    // route (system default) or the payment module (Razorpay provider, behind
    // CHECKOUT_RAZORPAY_PROVIDER=1). Never both — that is two orders for one cart.
    const provider = checkoutProvider();
    if (provider.reason === "flag-set-but-incomplete") {
      // Say it out loud. A silent fallback makes the flag look like it works.
      console.warn(
        "[checkout] CHECKOUT_RAZORPAY_PROVIDER is set but not usable; missing:",
        provider.missing.join(", ")
      );
    }
    let session = await medusa.ensurePaymentSession(cart_id, provider.providerId);

    if (provider.providerId === RAZORPAY_PROVIDER) {
      // The provider created the Razorpay order when the session was initiated.
      // Its data carries the order id; nothing else is created here.
      const razorpaySession = (session?.payment_sessions || []).find(
        (s: any) => s.provider_id === RAZORPAY_PROVIDER
      );
      const orderId = razorpaySession?.data?.razorpay_order_id || razorpaySession?.data?.id;
      if (!orderId) {
        return NextResponse.json(
          { error: "Payment could not be started. Please try again." },
          { status: 502 }
        );
      }
      return NextResponse.json({
        razorpay_order_id: orderId,
        amount: Number(razorpaySession?.amount ?? 0),
        currency: String(razorpaySession?.currency_code || "inr").toUpperCase(),
        status: "created",
        shipping_amount: 0,
        shipping: null,
        provider: RAZORPAY_PROVIDER,
      });
    }

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
      provider: provider.providerId,
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
