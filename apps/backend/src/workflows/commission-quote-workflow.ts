/**
 * Commission quote workflow (plain orchestration).
 *
 * Human-reviewed quote generation (Launch Rule, build plan Section 11.2).
 */

export type CommissionQuoteInput = {
  commission_request_id: string;
  scope: string;
  deliverables?: string;
  total_minor: number;
  tax_minor?: number;
  fee_share_minor?: number;
  deposit_rules?: Record<string, any>;
  milestone_schedule?: Record<string, any>;
  expiry_at?: Date;
  actor: string;
};

export type CommissionQuoteOutput = {
  commission_request_id: string;
  quote_id: string;
  version: number;
  status: string;
};

export async function commissionQuoteWorkflow({
  commissionModuleService,
  auditService,
  input,
}: {
  commissionModuleService: any;
  auditService: any;
  input: CommissionQuoteInput;
}): Promise<CommissionQuoteOutput> {
  const {
    commission_request_id,
    scope,
    deliverables,
    total_minor,
    tax_minor,
    fee_share_minor,
    deposit_rules,
    milestone_schedule,
    expiry_at,
    actor,
  } = input;

  const quote = await commissionModuleService.createCommissionQuote({
    commission_request_id,
    scope,
    deliverables,
    total_minor,
    tax_minor,
    fee_share_minor,
    deposit_rules,
    milestone_schedule,
    expiry_at,
    status: "draft",
  });

  await commissionModuleService.updateCommissionRequestStatus(
    commission_request_id,
    "Quote drafted" as any
  );

  await auditService.record({
    actor,
    actor_role: "admin",
    action: "commission_quote_drafted",
    entity: "commission_quote",
    entity_id: quote.id,
    before: null,
    after: { version: quote.version, total_minor },
  });

  return {
    commission_request_id,
    quote_id: quote.id,
    version: quote.version,
    status: "draft",
  };
}

export async function sendQuoteStep({
  commissionModuleService,
  auditService,
  input,
}: {
  commissionModuleService: any;
  auditService: any;
  input: { quote_id: string; actor: string };
}): Promise<void> {
  const { quote_id, actor } = input;

  const quote = await commissionModuleService.getCommissionQuote(quote_id);
  if (!quote) {
    throw new Error(`Commission quote ${quote_id} not found`);
  }

  await commissionModuleService.updateCommissionQuote(quote_id, {
    status: "sent",
  });

  await commissionModuleService.updateCommissionRequestStatus(
    quote.commission_request_id,
    "Quote sent" as any
  );

  await auditService.record({
    actor,
    actor_role: "admin",
    action: "commission_quote_sent",
    entity: "commission_quote",
    entity_id: quote_id,
    before: { status: "draft" },
    after: { status: "sent" },
  });
}
