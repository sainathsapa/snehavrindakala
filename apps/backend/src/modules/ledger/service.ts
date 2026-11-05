import { EarningsLedgerEntry } from "./entities/earnings_ledger_entry";
import { PayoutBatch } from "./entities/payout_batch";
import type {
  CreateEarningsLedgerEntryInput,
  CreatePayoutBatchInput,
  UpdatePayoutBatchInput,
} from "./types";

export class LedgerService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async createEarningsLedgerEntry(data: CreateEarningsLedgerEntryInput): Promise<EarningsLedgerEntry> {
    const entry = new EarningsLedgerEntry(data);
    return this.manager_.persistAndFlush(entry);
  }

  async getEarningsLedgerEntry(id: string): Promise<EarningsLedgerEntry | null> {
    return this.manager_.findOne(EarningsLedgerEntry, { id });
  }

  async listLedgerEntriesByPartner(
    partnerId: string,
    filter: {
      state?: string;
      source_type?: string;
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<{ entries: EarningsLedgerEntry[]; count: number }> {
    const { state, source_type, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = { partner_id: partnerId };
    if (state) where.state = state;
    if (source_type) where.source_type = source_type;

    const [entries, count] = await this.manager_.findAndCount(
      EarningsLedgerEntry,
      {
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { entries, count };
  }

  async markEntryPaid(
    id: string,
    metadata?: Record<string, any>
  ): Promise<EarningsLedgerEntry> {
    const entry = await this.manager_.findOne(EarningsLedgerEntry, { id });
    if (!entry) {
      throw new Error(`Ledger entry ${id} not found`);
    }
    entry.state = "paid";
    if (metadata) {
      entry.audit_metadata = {
        ...(entry.audit_metadata || {}),
        ...metadata,
      };
    }
    return this.manager_.persistAndFlush(entry);
  }

  async reverseEntry(
    id: string,
    reason: string,
    actorId: string
  ): Promise<EarningsLedgerEntry> {
    const entry = await this.manager_.findOne(EarningsLedgerEntry, { id });
    if (!entry) {
      throw new Error(`Ledger entry ${id} not found`);
    }
    if (entry.state === "reversed") {
      throw new Error(`Ledger entry ${id} already reversed`);
    }
    entry.state = "reversed";
    entry.audit_metadata = {
      ...(entry.audit_metadata || {}),
      reversed_at: new Date().toISOString(),
      reversed_by: actorId,
      reversal_reason: reason,
    };
    return this.manager_.persistAndFlush(entry);
  }

  async getPendingEarningsByPartner(partnerId: string): Promise<{
    entries: EarningsLedgerEntry[];
    total_minor: number;
  }> {
    const entries = await this.manager_.find(EarningsLedgerEntry, {
      partner_id: partnerId,
      state: "pending",
    });
    let total_minor = 0;
    for (const e of entries) {
      total_minor += Number(e.gross_basis || 0) - Number(e.deductions || 0) - Number(e.fee_share || 0);
    }
    return { entries, total_minor };
  }

  async createPayoutBatch(data: CreatePayoutBatchInput): Promise<PayoutBatch> {
    const batch = new PayoutBatch(data);
    return this.manager_.persistAndFlush(batch);
  }

  async getPayoutBatch(id: string): Promise<PayoutBatch | null> {
    return this.manager_.findOne(PayoutBatch, { id });
  }

  async listPayoutBatches(filter: {
    partner_id?: string;
    status?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ batches: PayoutBatch[]; count: number }> {
    const { partner_id, status, offset = 0, limit = 20 } = filter;
    const where: Record<string, any> = {};
    if (partner_id) where.partner_id = partner_id;
    if (status) where.status = status;

    const [batches, count] = await this.manager_.findAndCount(PayoutBatch, {
      where,
      skip: offset,
      take: limit,
      orderBy: { created_at: "DESC" },
    });

    return { batches, count };
  }

  async updatePayoutBatch(id: string, data: UpdatePayoutBatchInput): Promise<PayoutBatch> {
    const batch = await this.manager_.findOne(PayoutBatch, { id });
    if (!batch) {
      throw new Error(`Payout batch ${id} not found`);
    }
    Object.assign(batch, data);
    batch.updated_at = new Date();
    return this.manager_.persistAndFlush(batch);
  }

  async submitPayoutBatch(id: string, providerReference: string): Promise<PayoutBatch> {
    const batch = await this.manager_.findOne(PayoutBatch, { id });
    if (!batch) {
      throw new Error(`Payout batch ${id} not found`);
    }
    batch.status = "submitted";
    batch.provider_reference = providerReference;
    return this.manager_.persistAndFlush(batch);
  }

  async markPayoutBatchPaid(id: string, providerReference: string): Promise<PayoutBatch> {
    const batch = await this.manager_.findOne(PayoutBatch, { id });
    if (!batch) {
      throw new Error(`Payout batch ${id} not found`);
    }
    batch.status = "paid";
    batch.provider_reference = providerReference;
    return this.manager_.persistAndFlush(batch);
  }

  async reconcilePayoutBatch(id: string): Promise<PayoutBatch> {
    const batch = await this.manager_.findOne(PayoutBatch, { id });
    if (!batch) {
      throw new Error(`Payout batch ${id} not found`);
    }
    batch.status = "reconciled";
    batch.reconciled_at = new Date();
    return this.manager_.persistAndFlush(batch);
  }
}
