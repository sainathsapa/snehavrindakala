import type { ModuleExports } from "@medusajs/types";
import { LedgerService } from "./service";
import { EarningsLedgerEntry } from "./models/earnings_ledger_entry";

export const LEDGER_MODULE = "ledger";

export const ledgerModule: ModuleExports<typeof LedgerService> = {
  service: LedgerService,
};

export { LedgerService, EarningsLedgerEntry };
