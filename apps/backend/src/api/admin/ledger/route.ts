import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { LedgerService } from "../../../modules/ledger/service";

/**
 * GET /admin/ledger
 * List earnings ledger entries (finance view).
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const ledgerService = req.scope.resolve(
    "ledgerModuleService"
  ) as LedgerService;

  const { partner_id, state, offset, limit } = req.query as unknown as {
    partner_id?: string;
    state?: string;
    offset?: string;
    limit?: string;
  };

  const { entries, count } = await ledgerService.listLedgerEntriesByPartner(
    partner_id || "all",
    {
      state: state as any,
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 50,
    }
  );

  return res.status(200).json({
    earnings_ledger_entries: entries,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 50,
  });
}

export { GET };
