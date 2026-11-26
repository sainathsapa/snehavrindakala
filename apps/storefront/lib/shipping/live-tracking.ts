/**
 * The courier's own answer about a parcel.
 *
 * Until now /track showed what our database said: a status string we had last
 * written, sometimes days old. The buyer's real question — "where is it now?" —
 * is answered by Shiprocket's tracking endpoint, which returns the scan history
 * the courier itself recorded. `trackShipment()` has existed in shiprocket.ts
 * since the shipment flow was written and was never called from anywhere.
 *
 * Three rules this module follows:
 *
 *  - **Never fail the page.** A courier API that is slow, rate-limited or down
 *    must degrade to the stored status, not to an error screen. Every failure
 *    returns null and the caller keeps what it already had.
 *  - **Cache, briefly.** The tracking endpoint is rate-limited per account and
 *    a buyer refreshing the page should not cost a call each time. Five minutes
 *    is shorter than a courier's scan interval and longer than a refresh.
 *  - **Say when it was fetched.** A timeline without a timestamp looks live even
 *    when it is yesterday's, which is the one thing worse than showing nothing.
 */

import { trackShipment } from "./shiprocket";

export interface TrackingScan {
  /** ISO-ish string as the courier reports it; not normalised, not invented. */
  at: string | null;
  activity: string;
  location: string | null;
}

export interface LiveTracking {
  awb: string;
  courier: string | null;
  /** The courier's current status label, e.g. "Delivered", "In Transit". */
  status: string | null;
  /** Estimated delivery, when the courier gives one. */
  edd: string | null;
  scans: TrackingScan[];
  fetchedAt: string;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: LiveTracking | null }>();

/** Strip the noise Shiprocket adds and keep what a buyer can read. */
function normalise(awb: string, raw: any): LiveTracking | null {
  const data = raw?.tracking_data ?? raw?.data?.tracking_data ?? null;
  if (!data) return null;

  const activities = Array.isArray(data.shipment_track_activities)
    ? data.shipment_track_activities
    : Array.isArray(data.shipment_track)
      ? data.shipment_track
      : [];

  const scans: TrackingScan[] = activities
    .map((entry: any) => ({
      at: String(entry.date ?? entry["updated_at"] ?? "").trim() || null,
      activity: String(entry.activity ?? entry["sr-status-label"] ?? entry.status ?? "").trim(),
      location: String(entry.location ?? "").trim() || null,
    }))
    .filter((scan: TrackingScan) => scan.activity.length > 0);

  const status =
    String(data.track_status ?? data.shipment_status ?? "").trim() ||
    null;

  return {
    awb: String(data.awb_code ?? awb),
    courier: String(data.courier_name ?? "").trim() || null,
    status,
    edd: String(data.edd ?? data.etd ?? "").trim() || null,
    scans,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Live tracking for one AWB, or null when the courier cannot be reached.
 *
 * Never throws and never waits longer than the caller's patience: the request
 * inside shiprocket.ts has its own timeout, and any rejection here is swallowed
 * because the page has a stored status to fall back on.
 */
export async function liveTracking(
  awb: string,
  shiprocketOrderId?: string | null
): Promise<LiveTracking | null> {
  const code = String(awb || "").trim();
  if (!code) return null;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  try {
    const raw = await trackShipment(code, shiprocketOrderId);
    const value = normalise(code, raw);
    cache.set(code, { at: Date.now(), value });
    return value;
  } catch (error) {
    // Cached as a miss for the same window: an outage must not turn every page
    // view into another doomed request.
    console.warn(
      "[tracking] courier lookup failed:",
      (error as Error)?.message?.slice(0, 120)
    );
    cache.set(code, { at: Date.now(), value: null });
    return null;
  }
}
