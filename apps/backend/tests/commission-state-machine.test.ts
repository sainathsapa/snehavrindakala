/**
 * Unit tests for the commission state machine workflow.
 * Validates all allowed and disallowed status transitions.
 */

import { CommissionRequest } from "../src/modules/commission/entities/commission_request";
import { commissionStateMachineWorkflow } from "../src/workflows/commission-state-machine";
import { vi } from "vitest";

describe("Commission state machine", () => {
  describe("canTransition", () => {
    const validTransitions: Array<[string, string]> = [
      ["New", "Needs clarification"],
      ["New", "Feasibility review"],
      ["New", "Declined"],
      ["New", "Expired"],
      ["Feasibility review", "Awaiting artist/capacity"],
      ["Awaiting artist/capacity", "Quote drafted"],
      ["Quote drafted", "Quote sent"],
      ["Quote sent", "Awaiting payment"],
      ["Awaiting payment", "Accepted"],
      ["Accepted", "In production"],
      ["In production", "Proof review"],
      ["Proof review", "Approved"],
      ["Approved", "Ready to dispatch"],
      ["Ready to dispatch", "Shipped"],
      ["Shipped", "Completed"],
      ["Cancelled", "New"],
      ["Declined", "New"],
    ];

    const invalidTransitions: Array<[string, string]> = [
      ["New", "Accepted"],
      ["New", "In production"],
      ["Quote sent", "Completed"],
      ["Completed", "Shipped"],
      ["Refunded", "Completed"],
      ["Declined", "Completed"],
    ];

    test.each(validTransitions)(
      "allows transition from %s to %s",
      (from, to) => {
        expect(
          CommissionRequest.canTransition(from as any, to as any)
        ).toBe(true);
      }
    );

    test.each(invalidTransitions)(
      "rejects transition from %s to %s",
      (from, to) => {
        expect(
          CommissionRequest.canTransition(from as any, to as any)
        ).toBe(false);
      }
    );
  });

  describe("workflow", () => {
    test("valid transition succeeds", async () => {
      const mockCommissionService = {
        getCommissionRequest: vi.fn().mockResolvedValue({
          id: "commission_1",
          status: "New",
        }),
        updateCommissionRequestStatus: vi.fn().mockResolvedValue({
          id: "commission_1",
          status: "Feasibility review",
        }),
      };

      const mockAuditService = {
        record: vi.fn().mockResolvedValue(undefined),
      };

      const result = await commissionStateMachineWorkflow({
        commissionRequestService: mockCommissionService,
        auditService: mockAuditService,
        input: {
          commission_request_id: "commission_1",
          to_status: "Feasibility review",
          actor: "admin_1",
        },
      });

      expect(result.transition_valid).toBe(true);
      expect(result.from_status).toBe("New");
      expect(result.to_status).toBe("Feasibility review");
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    test("invalid transition throws error", async () => {
      const mockCommissionService = {
        getCommissionRequest: vi.fn().mockResolvedValue({
          id: "commission_1",
          status: "New",
        }),
        updateCommissionRequestStatus: vi.fn(),
      };

      const mockAuditService = {
        record: vi.fn(),
      };

      await expect(
        commissionStateMachineWorkflow({
          commissionRequestService: mockCommissionService,
          auditService: mockAuditService,
          input: {
            commission_request_id: "commission_1",
            to_status: "Accepted",
            actor: "admin_1",
          },
        })
      ).rejects.toThrow("Invalid commission transition");
    });

    test("missing commission request throws error", async () => {
      const mockCommissionService = {
        getCommissionRequest: vi.fn().mockResolvedValue(null),
      };

      const mockAuditService = {
        record: vi.fn(),
      };

      await expect(
        commissionStateMachineWorkflow({
          commissionRequestService: mockCommissionService,
          auditService: mockAuditService,
          input: {
            commission_request_id: "nonexistent",
            to_status: "Feasibility review",
            actor: "admin_1",
          },
        })
      ).rejects.toThrow("not found");
    });
  });
});
