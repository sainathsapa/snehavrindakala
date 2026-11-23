/**
 * GET|POST /api/cron/reconcile-payments
 *
 * Works the payment reconciliation queue using the provider API as the only
 * source of truth. The verifier adapter is the test adapter by default and the
 * Razorpay adapter only when real credentials are configured; the response
 * reports which mode ran so a test-mode run can never be mistaken for real.
 *
 * Guarded by CRON_SECRET. Unset => 503 (configuration problem), wrong => 401.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron-auth";
import {
  getPaymentVerifier,
  listReconciliationIssues,
  runReconciliationBatch,
} from "@/lib/payments/reconciliation";

export const dynamic = "force-dynamic";

/** A cap per run keeps a provider outage from turning into a huge backlog burst. */
const MAX_PER_RUN = 100;

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = authoriseCron({
    secret: process.env.CRON_SECRET,
    authorization: req.headers.get("authorization"),
    querySecret: url.searchParams.get("secret"),
  });
  if (!auth.ok) {
    const status = process.env.CRON_SECRET ? 401 : 503;
    return NextResponse.json({ error: auth.reason }, { status });
  }

  try {
    const [open, retrying] = await Promise.all([
      listReconciliationIssues({ status: "open", limit: MAX_PER_RUN }),
      listReconciliationIssues({ status: "retrying", limit: MAX_PER_RUN }),
    ]);
    const verifier = getPaymentVerifier();
    const result = await runReconciliationBatch(
      [...open, ...retrying],
      verifier
    );
    return NextResponse.json({
      ...result,
      providerMode: verifier.mode,
      note:
        verifier.mode === "test"
          ? "Test verifier: no live payment data was queried."
          : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reconciliation run failed";
    console.error("[cron] reconcile-payments failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
