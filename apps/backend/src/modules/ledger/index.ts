import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { LedgerService } from "./service";

export const LEDGER_MODULE = "ledger";

export { EarningsLedgerEntry, PayoutBatch } from "./entities";
export type { LedgerEntryState, LedgerSourceType } from "./entities";
export type { PayoutBatchStatus } from "./entities";
export { LedgerService };

/**
 * The ledger module. DML entities are auto-registered with MikroORM via
 * LedgerService extending MedusaService({ EarningsLedgerEntry, PayoutBatch }).
 */
export const ledgerModule: ModuleExports<typeof LedgerService> = {
  service: LedgerService,
};

export default Module(LEDGER_MODULE, { service: LedgerService });
