/**
 * POST /api/webhooks/courier — shipment status callback (public alias).
 *
 * Shiprocket rejects webhook URLs that contain the words shiprocket, kartrocket,
 * sr or kr, so the dashboard entry point cannot use /api/webhooks/shiprocket.
 * This route is the same handler under a neutral path; keep the two in sync by
 * re-exporting rather than copying, so token checking and upsert logic cannot
 * drift apart.
 */

export { POST, dynamic } from "../shiprocket/route";
