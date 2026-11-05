import { CommissionRequest } from "./entities/commission_request";
import { CommissionAttachment } from "./entities/commission_attachment";
import { CommissionQuote } from "./entities/commission_quote";
import { CommissionMilestone } from "./entities/commission_milestone";
import { CommissionRevision } from "./entities/commission_revision";
import type { CommissionStatus } from "./entities/commission_request";
import type { QuoteStatus } from "./entities/commission_quote";
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

export class CommissionService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async createCommissionRequest(data: CreateCommissionRequestInput): Promise<CommissionRequest> {
    const req = new CommissionRequest({
      ...data,
      status: "New",
    });
    return this.manager_.persistAndFlush(req);
  }

  async getCommissionRequest(id: string): Promise<CommissionRequest | null> {
    return this.manager_.findOne(CommissionRequest, { id });
  }

  async getCommissionRequestByReference(reference_id: string): Promise<CommissionRequest | null> {
    return this.manager_.findOne(CommissionRequest, { reference_id });
  }

  async listCommissionRequests(filter: {
    customer_id?: string;
    status?: CommissionStatus;
    assigned_artist_id?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ requests: CommissionRequest[]; count: number }> {
    const { customer_id, status, assigned_artist_id, offset = 0, limit = 20 } = filter;
    const where: Record<string, any> = {};
    if (customer_id) where.customer_id = customer_id;
    if (status) where.status = status;
    if (assigned_artist_id) where.assigned_artist_id = assigned_artist_id;

    const [requests, count] = await this.manager_.findAndCount(CommissionRequest, {
      where,
      skip: offset,
      take: limit,
      orderBy: { created_at: "DESC" },
    });

    return { requests, count };
  }

  async updateCommissionRequestStatus(id: string, newStatus: CommissionStatus): Promise<CommissionRequest> {
    const req = await this.manager_.findOne(CommissionRequest, { id });
    if (!req) {
      throw new Error(`Commission request ${id} not found`);
    }

    if (!CommissionRequest.canTransition(req.status, newStatus)) {
      throw new Error(`Invalid transition from ${req.status} to ${newStatus}`);
    }

    req.status = newStatus;
    req.updated_at = new Date();
    return this.manager_.persistAndFlush(req);
  }

  async assignArtist(id: string, artistId: string): Promise<CommissionRequest> {
    const req = await this.manager_.findOne(CommissionRequest, { id });
    if (!req) {
      throw new Error(`Commission request ${id} not found`);
    }
    req.assigned_artist_id = artistId;
    req.updated_at = new Date();
    return this.manager_.persistAndFlush(req);
  }

  async createCommissionAttachment(data: CreateCommissionAttachmentInput): Promise<CommissionAttachment> {
    const att = new CommissionAttachment(data);
    return this.manager_.persistAndFlush(att);
  }

  async listAttachmentsByCommission(commissionRequestId: string): Promise<CommissionAttachment[]> {
    return this.manager_.find(CommissionAttachment, {
      commission_request_id: commissionRequestId,
    });
  }

  async markAttachmentScanned(id: string, passed: boolean, result?: string): Promise<CommissionAttachment> {
    const att = await this.manager_.findOne(CommissionAttachment, { id });
    if (!att) {
      throw new Error(`Attachment ${id} not found`);
    }
    att.scan_complete = true;
    att.scan_passed = passed;
    att.scan_result = result ?? null;
    return this.manager_.persistAndFlush(att);
  }

  async createCommissionQuote(data: CreateCommissionQuoteInput): Promise<CommissionQuote> {
    const last = await this.manager_.findOne(CommissionQuote, {
      commission_request_id: data.commission_request_id,
    }, { orderBy: { version: "DESC" } });
    const version = last ? last.version + 1 : 1;

    const quote = new CommissionQuote({
      ...data,
      version,
      status: "draft",
    });
    return this.manager_.persistAndFlush(quote);
  }

  async getCommissionQuote(id: string): Promise<CommissionQuote | null> {
    return this.manager_.findOne(CommissionQuote, { id });
  }

  async listQuotesByCommission(commissionRequestId: string): Promise<CommissionQuote[]> {
    return this.manager_.find(CommissionQuote, {
      commission_request_id: commissionRequestId,
    }, { orderBy: { version: "DESC" } });
  }

  async updateCommissionQuote(id: string, data: UpdateCommissionQuoteInput): Promise<CommissionQuote> {
    const quote = await this.manager_.findOne(CommissionQuote, { id });
    if (!quote) {
      throw new Error(`Commission quote ${id} not found`);
    }
    Object.assign(quote, data);
    quote.updated_at = new Date();
    return this.manager_.persistAndFlush(quote);
  }

  async acceptQuote(id: string): Promise<CommissionQuote> {
    const quote = await this.manager_.findOne(CommissionQuote, { id });
    if (!quote) {
      throw new Error(`Commission quote ${id} not found`);
    }
    quote.status = "accepted";
    return this.manager_.persistAndFlush(quote);
  }

  async createCommissionMilestone(data: CreateCommissionMilestoneInput): Promise<CommissionMilestone> {
    const ms = new CommissionMilestone(data);
    return this.manager_.persistAndFlush(ms);
  }

  async listMilestonesByCommission(commissionRequestId: string): Promise<CommissionMilestone[]> {
    return this.manager_.find(CommissionMilestone, {
      commission_request_id: commissionRequestId,
    }, { orderBy: { sequence: "ASC" } });
  }

  async updateCommissionMilestone(id: string, data: UpdateCommissionMilestoneInput): Promise<CommissionMilestone> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    Object.assign(ms, data);
    ms.updated_at = new Date();
    return this.manager_.persistAndFlush(ms);
  }

  async submitMilestoneProof(id: string, proofObjectKey: string): Promise<CommissionMilestone> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    ms.proof_object_key = proofObjectKey;
    ms.status = "proof_submitted";
    return this.manager_.persistAndFlush(ms);
  }

  async approveMilestone(id: string, approvalRecord: Record<string, any>): Promise<CommissionMilestone> {
    const ms = await this.manager_.findOne(CommissionMilestone, { id });
    if (!ms) {
      throw new Error(`Commission milestone ${id} not found`);
    }
    ms.status = "approved";
    ms.approval_record = approvalRecord;
    return this.manager_.persistAndFlush(ms);
  }

  async createCommissionRevision(data: CreateCommissionRevisionInput): Promise<CommissionRevision> {
    const last = await this.manager_.findOne(CommissionRevision, {
      milestone_id: data.milestone_id,
    }, { orderBy: { revision_number: "DESC" } });
    const revision_number = last ? last.revision_number + 1 : 1;

    const rev = new CommissionRevision({
      ...data,
      revision_number,
    });
    return this.manager_.persistAndFlush(rev);
  }

  async listRevisionsByMilestone(milestoneId: string): Promise<CommissionRevision[]> {
    return this.manager_.find(CommissionRevision, {
      milestone_id: milestoneId,
    }, { orderBy: { revision_number: "ASC" } });
  }
}
