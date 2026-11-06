import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { LedgerService } from "../../../../modules/ledger/service";

/**
 * GET /admin/ledger/payout
 * List payout batches.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const ledgerService = req.scope.resolve(
    "ledger"
  ) as LedgerService;

  const { partner_id, status, offset, limit } = req.query as unknown as {
    partner_id?: string;
    status?: string;
    offset?: string;
    limit?: string;
  };

  const { batches, count } = await ledgerService.listPayoutBatches({
    partner_id,
    status: status as any,
    offset: offset ? Number(offset) : 0,
    limit: limit ? Number(limit) : 20,
  });

  return res.status(200).json({
    payout_batches: batches,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 20,
  });
}

/**
 * POST /admin/ledger/payout
 * Create a payout batch (finance).
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ledgerService = req.scope.resolve(
    "ledger"
  ) as LedgerService;

  const body = req.body as any;

  try {
    const batch = await ledgerService.createPayoutBatch(body);
    return res.status(201).json({ payout_batch: batch });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to create payout batch",
    });
  }
}

export { GET, POST };
