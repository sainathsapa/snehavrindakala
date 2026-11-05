import {
  EarningsLedgerEntry,
  EarningsLedgerEntryInput,
} from "./models/earnings_ledger_entry";

export class LedgerService {
  private entries: Map<string, EarningsLedgerEntry> = new Map();

  async create(
    data: EarningsLedgerEntryInput
  ): Promise<EarningsLedgerEntry> {
    const id = data.id ?? `ledger_${Date.now()}`;
    const now = new Date();
    const entry: EarningsLedgerEntry = {
      id,
      state: "pending",
      currency: "INR",
      created_at: now,
      ...data,
    } as EarningsLedgerEntry;
    this.entries.set(id, entry);
    return entry;
  }

  async findOne(
    selector: Record<string, unknown>
  ): Promise<EarningsLedgerEntry | null> {
    const all = await this.list(selector);
    return all.length ? all[0] : null;
  }

  async list(
    selector: Record<string, unknown> = {}
  ): Promise<EarningsLedgerEntry[]> {
    return Array.from(this.entries.values()).filter((e) =>
      Object.entries(selector).every(([k, v]) => (e as any)[k] === v)
    );
  }

  async listByPartner(
    partnerId: string
  ): Promise<EarningsLedgerEntry[]> {
    return this.list({ partner_id: partnerId });
  }
}
