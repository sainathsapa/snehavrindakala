import { MedusaService } from "@medusajs/medusa";
import { EarningsLedgerEntry } from "./models/earnings_ledger_entry";

export class LedgerService extends MedusaService({
  EarningsLedgerEntry,
}) {
  async listByPartner(partnerId: string) {
    return this.find({ where: { partner_id: partnerId } });
  }
}
