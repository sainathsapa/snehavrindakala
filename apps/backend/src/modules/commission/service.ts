/**
 * Commission service. Business logic for custom-art commission requests.
 *
 * The DML entities are registered with MikroORM via
 * MedusaServiceModelObjectsSymbol so the module's data model is resolved at
 * runtime. This fixes the "model metadata" failures that previously caused
 * 500s on commission endpoints.
 */
import {
  CommissionRequest,
  CommissionAttachment,
  CommissionQuote,
  CommissionMilestone,
  CommissionRevision,
} from "./entities/index";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import { randomUUID } from "crypto";
import type { CommissionStatus } from "./entities/commission_request";
import type { QuoteStatus } from "./entities/commission_quote";
import { canTransition } from "./entities/commission_request";
import type {
  CreateCommissionRequestInput,
  UpdateCommissionRequestInput,
  CreateCommissionAttachmentInput,
  CreateCommissionQuoteInput,
  UpdateCommissionQuoteInput,
  CreateCommissionMilestoneInput,
  UpdateCommissionMilestoneInput,
  CreateCommissionRevisionInput,
} from "./types";

const MODEL_OBJECTS = {
  CommissionRequest,
  CommissionAttachment,
  CommissionQuote,
  CommissionMilestone,
  CommissionRevision,
};

export class CommissionService {
  protected readonly manager_: any;
  protected readonly eventBus_: any;

  constructor({ manager, event_bus }: { manager: any; event_bus?: any }) {
    this.manager_ = manager;
    this.eventBus_ = event_bus;
  }

  /**
   * Emit a domain event without letting a bus failure break the write.
   *
   * The commission subscriber has always listened for these names, but nothing
   * ever emitted them — so no commission notification has ever been sent. The
   * request is already persisted by the time we get here, so a failed emit is
   * logged rather than surfaced to the customer as a failed submission.
   */
  private async emit(name: string, data: Record<string, any>): Promise<void> {
    if (!this.eventBus_?.emit) {
      console.warn(`[commission] no event bus; dropped event "${name}"`);
      return;
    }
    try {
      await this.eventBus_.emit({ name, data });
    } catch (err) {
      console.error(`[commission] failed to emit "${name}"`, err);
    }
  }

  async createCommissionRequest(
    data: CreateCommissionRequestInput
  ): Promise<any> {
    // `customer_email` is transport metadata for the acknowledgement email, not
    // a column on commission_request. Passing it to create() would raise an
    // unknown-property error, so peel it off before persisting.
    const { customer_email, ...persistable } = data;

    const req = this.manager_
      .getRepository(CommissionRequest)
      .create({ ...persistable, id: randomUUID(), status: data.status ?? "New" });
    await this.manager_.persistAndFlush(req);

    await this.emit("commission.request.created", {
      commission_request_id: req.id,
      reference_id: req.reference_id,
      customer_id: req.customer_id,
      customer_email,
      art_form: req.art_form,
      brief: req.brief,
      budget_range: req.budget_range,
      target_date: req.target_date,
    });

    return req;
  }

  async getCommissionRequest(id: string): Promise<any | null> {
    return this.manager_.findOne(CommissionRequest, { id });
  }

  async getCommissionRequestByReference(
    reference_id: string
  ): Promise<any | null> {
    return this.manager_.findOne(CommissionRequest, { reference_id });
  }

  async listCommissionRequests(filter: {
    customer_id?: string;
    status?: CommissionStatus;
    assigned_artist_id?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ requests: any[]; count: number }> {
    const { customer_id, status, assigned_artist_id, offset = 0, limit = 20 } =
      filter;
    const where: Record<string, any> = {};
    if (customer_id) where.customer_id = customer_id;
    if (status) where.status = status;
    if (assigned_artist_id) where.assigned_artist_id = assigned_artist_id;

    const [requests, count] = await this.manager_.findAndCount(
      CommissionRequest,
      where,
      {
        offset,
        limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { requests, count };
  }

  async updateCommissionRequestStatus(
    id: string,
    newStatus: CommissionStatus
  ): Promise<any> {
    const req = await this.manager_.findOne(CommissionRequest, { id });
    if (!req) {
      throw new Error(`Commission request ${id} not found`);
    }

    if (!canTransition(req.status as CommissionStatus, newStatus)) {
      throw new Error(`Invalid transition from ${req.status} to ${newStatus}`);
    }

    const fromStatus = req.status;
    req.status = newStatus;
    req.updated_at = new Date();
    await this.manager_.persistAndFlush(req);

    await this.emit("commission.status.transitioned", {
      commission_request_id: req.id,
      reference_id: req.reference_id,
      customer_id: req.customer_id,
      customer_email: (req as any).customer_email,
      from_status: fromStatus,
      to_status: newStatus,
    });

    return req;
  }

  async assignArtist(id: string, artistId: string): Promise<any> {
    const req = await this.manager_.findOne(CommissionRequest, { id });
    if (!req) {
      throw new Error(`Commission request ${id} not found`);
    }
    req.assigned_artist_id = artistId;
    req.updated_at = new Date();
    await this.manager_.persistAndFlush(req);
    return req;
  }

  async createCommissionAttachment(
    data: CreateCommissionAttachmentInput
  ): Promise<any> {
    const att = this.manager_
      .getRepository(CommissionAttachment)
      .create({ ...data, id: randomUUID() });
    await this.manager_.persistAndFlush(att);
    return att;
  }

  async listAttachmentsByCommission(
    commissionRequestId: string
  ): Promise<any[]> {
    return this.manager_.find(CommissionAttachment, {
      commission_request_id: commissionRequestId,
    });
  }

  async markAttachmentScanned(
    id: string,
    passed: boolean,
    result?: string
  ): Promise<any> {
    const att = await this.manager_.findOne(CommissionAttachment, { id });
    if (!att) {
      throw new Error(`Attachment ${id} not found`);
    }
    att.scan_complete = true;
    att.scan_passed = passed;
    att.scan_result = result ?? null;
    await this.manager_.persistAndFlush(att);
    return att;
  }

  async createCommissionQuote(
    data: CreateCommissionQuoteInput
  ): Promise<any> {
    const last = await this.manager_.findOne(CommissionQuote, {
      commission_request_id: data.commission_request_id,
    }, { orderBy: { version: "DESC" } });
    const version = last ? (last as any).version + 1 : 1;

    const quote = this.manager_.getRepository(CommissionQuote).create({
      ...data,
      id: randomUUID(),
      version,
      status: "draft",
    });
    await this.manager_.persistAndFlush(quote);
    return quote;
  }

  async getCommissionQuote(id: string): Promise<any | null> {
    return this.manager_.findOne(CommissionQuote, { id });
  }

  async listQuotesByCommission(commissionRequestId: string): Promise<any[]> {
    return this.manager_.find(CommissionQuote, {
      commission_request_id: commissionRequestId,
    }, { orderBy: { version: "DESC" } });
  }

  async updateCommissionQuote(
    id: string,
    data: UpdateCommissionQuoteInput
  ): Promise<any> {
    const quote = await this.manager_.findOne(CommissionQuote, { id });
    if (!quote) {
      throw new Error(`Commission quote ${id} not found`);
    }
    Object.assign(quote, data);
    quote.updated_at = new Date();
    await this.manager_.persistAndFlush(quote);
    return quote;
  }

  async acceptQuote(id: string): Promise<any> {
    const quote = await this.manager_.findOne(CommissionQuote, { id });
    if (!quote) {
      throw new Error(`Commission quote ${id} not found`);
    }
    quote.status = "accepted";
    await this.manager_.persistAndFlush(quote);
    return quote;
  }

  async createCommissionMilestone(
    data: CreateCommissionMilestoneInput
  ): Promise<any> {
    const ms = this.manager_
      .getRepository(CommissionMilestone)
      .create({ ...data, id: randomUUID() });
    await this.manager_.persistAndFlush(ms);
    return ms;
  }

  async listMilestonesByCommission(
    commissionRequestId: string
  ): Promise<any[]> {
    return this.manager_.find(CommissionMilestone, {
      commission_request_id: commissionRequestId,
    }, { orderBy: { sequence: "ASC" } });
  }

  async updateCommissionMilestone(
    id: string,
    data: UpdateCommissionMilestoneInput
  ): Promise<any> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    Object.assign(ms, data);
    ms.updated_at = new Date();
    await this.manager_.persistAndFlush(ms);
    return ms;
  }

  async submitMilestoneProof(
    id: string,
    proofObjectKey: string
  ): Promise<any> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    ms.proof_object_key = proofObjectKey;
    ms.status = "proof_submitted";
    await this.manager_.persistAndFlush(ms);
    return ms;
  }

  async approveMilestone(
    id: string,
    approvalRecord: Record<string, any>
  ): Promise<any> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    ms.status = "approved";
    ms.approval_record = approvalRecord;
    await this.manager_.persistAndFlush(ms);
    return ms;
  }

  async createCommissionRevision(
    data: CreateCommissionRevisionInput
  ): Promise<any> {
    const last = await this.manager_.findOne(CommissionRevision, {
      milestone_id: data.milestone_id,
    }, { orderBy: { revision_number: "DESC" } });
    const revision_number = last ? (last as any).revision_number + 1 : 1;

    const rev = this.manager_.getRepository(CommissionRevision).create({
      ...data,
      id: randomUUID(),
      revision_number,
    });
    await this.manager_.persistAndFlush(rev);
    return rev;
  }

  async listRevisionsByMilestone(milestoneId: string): Promise<any[]> {
    return this.manager_.find(CommissionRevision, {
      milestone_id: milestoneId,
    }, { orderBy: { revision_number: "ASC" } });
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
(CommissionService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
