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

/**
 * Where new commission requests are announced internally.
 *
 * Never fall back to a hard-coded address: a wrong-but-valid address silently
 * sends customer briefs to nobody, which is how the previous
 * `commissions@snehavrindakala.example` default behaved.
 */
function getCommissionInbox(): string | null {
  const inbox = (
    process.env.COMMISSION_INBOX ||
    process.env.CONTACT_EMAIL ||
    ""
  ).trim();
  return inbox.includes("@") ? inbox : null;
}

export default async function commissionSubscriber(args: any): Promise<void> {
  const { event, container } = args;
  const eventName = event?.event_name || event?.type || "unknown";
  const data = event?.data || {};
  const id = event?.id || "";

  const notificationModuleService = container.resolve("notification");
  const ledgerModuleService = container.resolve("ledger");
  const integrationEventService = container.resolve("integration_event");

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
        // The ops inbox must be configurable. The previous hard-coded address
        // (commissions@snehavrindakala.example) is a reserved .example domain
        // that can never receive mail, so every request notified nobody.
        const opsInbox = getCommissionInbox();
        if (opsInbox) {
          await notificationModuleService.sendNotification?.({
            to: opsInbox,
            template: "new_commission_request",
            data: {
              commission_request_id,
              customer_id,
              art_form,
              brief: data?.brief,
              budget_range: data?.budget_range,
              target_date: data?.target_date,
              reference_id: data?.reference_id,
            },
          });
        } else {
          console.warn(
            "No COMMISSION_INBOX configured — commission request " +
              `${commission_request_id} notified nobody.`
          );
        }
      } catch (err) {
        console.error("New commission notification failed", err);
      }

      // Acknowledge to the customer so they know the brief landed and have a
      // reference to return with. Without this the submit form is a dead end.
      try {
        const { customer_email } = data || {};
        if (customer_email) {
          await notificationModuleService.sendNotification?.({
            to: customer_email,
            template: "commission_request_received",
            data: {
              commission_request_id,
              reference_id: data?.reference_id,
            },
          });
        }
      } catch (err) {
        console.error("Commission acknowledgement failed", err);
      }
      break;
    }

    case "commission.status.transitioned": {
      const {
        commission_request_id,
        reference_id,
        customer_email,
        from_status,
        to_status,
      } = data || {};
      console.log(
        `[Subscriber] Commission ${commission_request_id}: ${from_status} → ${to_status}`
      );

      // Not every internal move is worth an email. Notify on the transitions a
      // customer actually needs to act on or would worry about otherwise.
      const NOTIFY_ON = new Set([
        "Needs clarification",
        "Quote sent",
        "Awaiting payment",
        "Accepted",
        "In production",
        "Proof review",
        "Approved",
        "Shipped",
        "Completed",
        "Declined",
        "Cancelled",
        "On hold",
        "Refunded",
      ]);

      if (!customer_email || !NOTIFY_ON.has(to_status)) {
        break;
      }

      try {
        await notificationModuleService.sendNotification?.({
          to: customer_email,
          template: "commission_status_changed",
          data: {
            commission_request_id,
            reference_id,
            from_status,
            to_status,
          },
        });
      } catch (err) {
        console.error("Commission transition notification failed", err);
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
          template: "commission_status_changed",
          data: {
            commission_request_id,
            reference_id: data?.reference_id,
            to_status: data?.to_status,
            from_status: data?.from_status,
          },
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
          template: "commission_status_changed",
          data: {
            commission_request_id,
            reference_id: data?.reference_id,
            to_status: "Proof approved",
            milestone_id,
          },
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
