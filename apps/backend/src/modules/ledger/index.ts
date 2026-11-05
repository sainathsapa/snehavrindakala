import type { ModuleExports } from "@medusajs/types";
import { LedgerService } from "./service";

export const LEDGER_MODULE = "ledger";

export const ledgerModule: ModuleExports<typeof LedgerService> = {
  service: LedgerService,
};

export { LedgerService };
