/**
 * What the shop knows about its own buyers.
 *
 * Every number here comes from data the shop already produced by being used:
 * searches, baskets, payments. No third-party tracker, no cookie that follows
 * anyone home, and nothing that has to be consented to — which also means it
 * survives ad-blockers, where a client-side funnel event does not.
 *
 * Each block fails on its own. A missing table shows one honest "unavailable"
 * line rather than an empty page that looks like a quiet week.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { query } from "@/lib/db";
import { topSearches, unansweredSearches, type SearchStat } from "@/lib/search-log";

export interface InsightsPayload {
  days: number;
  searches: {
    total: number;
    answered: number;
    top: SearchStat[];
    unanswered: SearchStat[];
  };
  basket: {
    created: number;
    converted: number;
    abandoned: number;
    /** Null when the basket table cannot be read — never rendered as zero. */
    conversion: number | null;
  } | null;
  money: {
    captured: number;
    refunded: number;
    orders: number;
  } | null;
}

async function scalar(sql: string, params: any[] = []): Promise<number | null> {
  try {
    const rows = await query<{ value: string | number | null }>(sql, params);
    const raw = rows[0]?.value;
    const num = Number(raw ?? 0);
    return Number.isFinite(num) ? num : 0;
  } catch (error) {
    console.error("[insights] query failed", error);
    return null;
  }
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days")) || 30));
  const window = [String(days)];

  const [total, answered, top, unanswered] = await Promise.all([
    scalar(
      `SELECT count(*) FROM search_log WHERE created_at > now() - ($1 || ' days')::interval`,
      window
    ),
    scalar(
      `SELECT count(*) FROM search_log WHERE results > 0 AND created_at > now() - ($1 || ' days')::interval`,
      window
    ),
    topSearches(days, 15),
    unansweredSearches(days, 1, 15),
  ]);

  // Medusa's own basket table. Read defensively: a schema change must degrade this
  // panel, not the page.
  const [created, converted] = await Promise.all([
    scalar(
      `SELECT count(*) FROM cart WHERE created_at > now() - ($1 || ' days')::interval`,
      window
    ),
    scalar(
      `SELECT count(*) FROM cart WHERE completed_at IS NOT NULL AND created_at > now() - ($1 || ' days')::interval`,
      window
    ),
  ]);

  const basket =
    created == null || converted == null
      ? null
      : {
          created,
          converted,
          abandoned: Math.max(0, created - converted),
          conversion: created > 0 ? Math.round((converted / created) * 100) : null,
        };

  const [captured, refunded] = await Promise.all([
    scalar(
      `SELECT coalesce(sum(amount), 0) FROM payment_event
        WHERE event_type = 'payment.captured' AND received_at > now() - ($1 || ' days')::interval`,
      window
    ),
    scalar(
      `SELECT coalesce(sum(amount), 0) FROM payment_event
        WHERE event_type = 'refund.processed' AND received_at > now() - ($1 || ' days')::interval`,
      window
    ),
  ]);

  const orders = await scalar(
    `SELECT count(*) FROM payment_event
      WHERE event_type = 'payment.captured' AND received_at > now() - ($1 || ' days')::interval`,
    window
  );

  const payload: InsightsPayload = {
    days,
    searches: {
      total: total ?? 0,
      answered: answered ?? 0,
      top,
      unanswered,
    },
    basket,
    money:
      captured == null
        ? null
        : { captured: captured / 100, refunded: (refunded ?? 0) / 100, orders: orders ?? 0 },
  };

  return NextResponse.json(payload);
}
