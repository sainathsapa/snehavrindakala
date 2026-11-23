/**
 * Release expired stock holds.
 *
 * A buyer who closes the tab after a payment session was created leaves an
 * active reservation. Without this sweep that unit stays unavailable forever.
 * Guarded by CRON_SECRET like the other scheduled routes; refuses when unset.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron-auth";
import { releaseExpiredReservations } from "@/lib/inventory";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = authoriseCron({
    secret: process.env.CRON_SECRET,
    authorization: req.headers.get("authorization"),
    querySecret: url.searchParams.get("secret"),
  });
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: process.env.CRON_SECRET ? 401 : 503 }
    );
  }
  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({ released });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
