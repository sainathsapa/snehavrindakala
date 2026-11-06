/**
 * Commission state machine workflow (plain orchestration).
 *
 * Validates and applies commission status transitions against the allowed
 * transition graph (build plan Section 11.3).
 */

import { CommissionRequest } from "../modules/commission/entities/commission_request";
import { COMMISSION_TRANSITIONS } from "../modules/commission/entities/commission_request";
import type { CommissionStatus } from "../modules/commission/entities/commission_request";

export type CommissionTransitionInput = {
  commission_request_id: string;
  to_status: string;
  actor: string;
  reason?: string;
  metadata?: Record<string, any>;
};

export type CommissionTransitionOutput = {
  commission_request_id: string;
  from_status: string;
  to_status: string;
  transition_valid: boolean;
};

export async function commissionStateMachineWorkflow({
  commissionRequestService,
  auditService,
  input,
}: {
  commissionRequestService: any;
  auditService: any;
  input: CommissionTransitionInput;
}): Promise<CommissionTransitionOutput> {
  const { commission_request_id, to_status, actor, reason, metadata } = input;

  const commissionRequest =
    await commissionRequestService.getCommissionRequest(commission_request_id);
  if (!commissionRequest) {
    throw new Error(`Commission request ${commission_request_id} not found`);
  }

  const from_status = commissionRequest.status;
  const toStatus = to_status as CommissionStatus;

  const allowed =
    COMMISSION_TRANSITIONS[from_status as CommissionStatus];
  const transition_valid = Boolean(
    allowed && allowed.includes(toStatus)
  );

  if (!transition_valid) {
    throw new Error(
      `Invalid commission transition from ${from_status} to ${to_status}`
    );
  }

  await commissionRequestService.updateCommissionRequestStatus(
    commission_request_id,
    toStatus
  );

  await auditService.record({
    actor,
    actor_role: "system",
    action: "commission_status_transition",
    entity: "commission_request",
    entity_id: commission_request_id,
    before: { status: from_status },
    after: { status: to_status },
    request_correlation_id: metadata?.correlation_id,
  });

  return {
    commission_request_id,
    from_status,
    to_status,
    transition_valid,
  };
}
