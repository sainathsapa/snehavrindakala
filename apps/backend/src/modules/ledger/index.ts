import type { Module } from "@medusajs/framework/types";
import { LedgerService } from "./service";
import { EarningsLedgerEntry } from "./models/earnings_ledger_entry";

export const LEDGER_MODULE = "ledger";

export const ledgerModule: Module = {
  name: LEDGER_MODULE,
  service: LedgerService,
  models: [EarningsLedgerEntry],
};

export { LedgerService, EarningsLedgerEntry };
