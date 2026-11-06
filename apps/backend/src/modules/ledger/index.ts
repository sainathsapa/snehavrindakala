import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { LedgerService } from "./service";

export const LEDGER_MODULE = "ledger";

export const ledgerModule: ModuleExports<typeof LedgerService> = {
  service: LedgerService,
};

export { LedgerService };


export default Module(LEDGER_MODULE, { service: LedgerService });
