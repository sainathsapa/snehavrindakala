/**
 * POST /api/webhooks/razorpay — signed Razorpay payment/refund callback.
 *
 * Thin adapter over `lib/payments/webhook.ts`. It reads the RAW request body so
 * the HMAC is verified over the exact bytes Razorpay signed (re-serialising JSON
 * would break the digest), verifies with the shared constant-time helper, and
 * lets the handler map every outcome to an explicit HTTP status:
 *
 *   503 not configured · 401 bad/missing signature · 400 bad payload ·
 *   422 unknown payment reference · 202 acknowledged-no-effect ·
 *   200 processed/idempotent duplicate · 500 transient failure (provider retries).
 *
 * No secret, signature or raw body is ever logged. No live Razorpay call is
 * made by this file itself — the verifier adapter is injected by the handler.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getPaymentVerifier } from "@/lib/payments/reconciliation";
import {
  findInternalTransaction,
  handleRazorpayWebhook,
} from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read request body.", code: "unreadable_body" },
      { status: 400 }
    );
  }

  try {
    const result = await handleRazorpayWebhook({
      rawBody,
      signature: req.headers.get("x-razorpay-signature"),
      secret: process.env.RAZORPAY_WEBHOOK_SECRET,
      executor: query,
      providerVerify: getPaymentVerifier(),
      findTransaction: (paymentId, providerOrderId) =>
        findInternalTransaction(paymentId, providerOrderId, query),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    // Defensive: the handler already maps its own failures. Nothing secret is
    // included in this response.
    return NextResponse.json(
      { error: "Webhook processing failed.", code: "processing_error" },
      { status: 500 }
    );
  }
}
