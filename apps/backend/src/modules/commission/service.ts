import {
  CommissionRequest,
  CommissionRequestInput,
} from "./models/commission_request";

export class CommissionService {
  private requests: Map<string, CommissionRequest> = new Map();

  async create(
    data: CommissionRequestInput
  ): Promise<CommissionRequest> {
    const id = data.id ?? `commission_${Date.now()}`;
    const now = new Date();
    const req: CommissionRequest = {
      id,
      status: "New",
      created_at: now,
      updated_at: now,
      ...data,
    } as CommissionRequest;
    this.requests.set(id, req);
    return req;
  }

  async findOne(
    selector: Record<string, unknown>
  ): Promise<CommissionRequest | null> {
    const all = await this.list(selector);
    return all.length ? all[0] : null;
  }

  async list(
    selector: Record<string, unknown> = {}
  ): Promise<CommissionRequest[]> {
    return Array.from(this.requests.values()).filter((r) =>
      Object.entries(selector).every(([k, v]) => (r as any)[k] === v)
    );
  }

  async getByReference(referenceId: string): Promise<CommissionRequest | null> {
    return this.findOne({ reference_id: referenceId });
  }

  async listByCustomer(
    customerId: string
  ): Promise<CommissionRequest[]> {
    return this.list({ customer_id: customerId });
  }

  async update(
    id: string,
    data: Partial<Omit<CommissionRequest, "id" | "created_at">>
  ): Promise<CommissionRequest | null> {
    const existing = this.requests.get(id);
    if (!existing) return null;
    const updated: CommissionRequest = {
      ...existing,
      ...data,
      updated_at: new Date(),
    };
    this.requests.set(id, updated);
    return updated;
  }
}
