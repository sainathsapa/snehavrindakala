import {
  PartnerApplication,
  PartnerApplicationInput,
} from "./models/partner_application";

export class PartnerService {
  private applications: Map<string, PartnerApplication> = new Map();

  async create(
    data: PartnerApplicationInput
  ): Promise<PartnerApplication> {
    const id = data.id ?? `partner_app_${Date.now()}`;
    const now = new Date();
    const app: PartnerApplication = {
      id,
      created_at: now,
      updated_at: now,
      ...data,
    } as PartnerApplication;
    this.applications.set(id, app);
    return app;
  }

  async findOne(
    selector: Record<string, unknown>
  ): Promise<PartnerApplication | null> {
    const all = await this.list(selector);
    return all.length ? all[0] : null;
  }

  async list(
    selector: Record<string, unknown> = {}
  ): Promise<PartnerApplication[]> {
    return Array.from(this.applications.values()).filter((a) =>
      Object.entries(selector).every(([k, v]) => (a as any)[k] === v)
    );
  }

  async listPending(): Promise<PartnerApplication[]> {
    return this.list({ review_status: "pending" });
  }

  async update(
    id: string,
    data: Partial<Omit<PartnerApplication, "id" | "created_at">>
  ): Promise<PartnerApplication | null> {
    const existing = this.applications.get(id);
    if (!existing) return null;
    const updated: PartnerApplication = {
      ...existing,
      ...data,
      updated_at: new Date(),
    };
    this.applications.set(id, updated);
    return updated;
  }
}
