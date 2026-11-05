/**
 * Commission subscriber (plain module).
 *
 * Listens to commission state transitions and milestone events, triggering
 * notifications and ledger entries.
 */

export const config = {
  event: [
    "commission.request.created",
    "commission.status.transitioned",
    "commission.quote.accepted",
    "commission.milestone.approved",
    "commission.completed",
  ],
};

export default async function commissionSubscriber(args: any): Promise<void> {
  const { event, container } = args;
  const eventName = event?.event_name || event?.type || "unknown";
  const data = event?.data || {};
  const id = event?.id || "";

  const notificationModuleService = container.resolve("notificationModuleService");
  const ledgerModuleService = container.resolve("ledgerModuleService");
  const integrationEventService = container.resolve("integrationEventModuleService");

  const correlationId = id;

  switch (eventName) {
    case "commission.request.created": {
      const { commission_request_id, customer_id, art_form } = data || {};
      console.log(
        `[Subscriber] Commission request created: ${commission_request_id} (${art_form})`
      );

      try {
        await integrationEventService.recordEvent({
          provider: "medusa",
          event_id: correlationId,
          event_type: "commission.request.created",
          received_at: new Date(),
          payload: data,
          signature_result: "internal",
          processing_state: "processed",
        });
      } catch (err) {
        console.error("Failed to record commission.created event", err);
      }

      try {
        await notificationModuleService.sendNotification?.({
          to: "commissions@snehavrindakala.example",
          template: "new_commission_request",
          data: { commission_request_id, customer_id, art_form },
        });
      } catch (err) {
        console.error("New commission notification failed", err);
      }
      break;
    }

    case "commission.quote.accepted": {
      const { commission_request_id, quote_id, total_minor, customer_id, assigned_artist_id } = data || {};
      console.log(
        `[Subscriber] Commission quote accepted: ${quote_id} for request ${commission_request_id}`
      );

      try {
        await ledgerModuleService.createEarningsLedgerEntry?.({
          partner_id: assigned_artist_id || "platform",
          source_type: "commission",
          source_id: commission_request_id,
          gross_basis: total_minor,
          deductions: 0,
          fee_share: 0,
          currency: "INR",
          state: "pending",
          audit_metadata: {
            quote_id,
            commission_request_id,
            accepted_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("Commission ledger entry failed", err);
      }

      try {
        await notificationModuleService.sendNotification?.({
          to: data?.customer_email,
          template: "commission_quote_accepted",
          data: { commission_request_id, quote_id },
        });
      } catch (err) {
        console.error("Quote accepted notification failed", err);
      }
      break;
    }

    case "commission.milestone.approved": {
      const { commission_request_id, milestone_id } = data || {};
      console.log(
        `[Subscriber] Milestone approved: ${milestone_id} for request ${commission_request_id}`
      );

      try {
        await notificationModuleService.sendNotification?.({
          to: data?.customer_email,
          template: "commission_milestone_approved",
          data: { commission_request_id, milestone_id },
        });
      } catch (err) {
        console.error("Milestone approved notification failed", err);
      }
      break;
    }

    case "commission.completed": {
      const { commission_request_id, artist_id, total_minor } = data || {};
      console.log(`[Subscriber] Commission completed: ${commission_request_id}`);

      try {
        const entries = await ledgerModuleService.listLedgerEntriesByPartner?.(
          artist_id,
          { source_type: "commission", state: "pending" }
        );
        for (const entry of entries?.entries || []) {
          if (entry.source_id === commission_request_id) {
            await ledgerModuleService.markEntryPaid?.(entry.id, {
              commission_request_id,
              paid_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("Commission ledger payout mark failed", err);
      }
      break;
    }

    default:
      console.log(`[Subscriber] Unhandled commission event: ${eventName}`);
  }
}
