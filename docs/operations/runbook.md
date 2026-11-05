# Production runbook (draft)

## Daily checklist (Section 19.1)
- Check new orders and verified payment status.
- Check commission requests and respond within the published response window.
- Check Shiprocket shipment creation failures, pickup, NDR, and RTO.
- Confirm made-to-order commitments against partner capacity.
- Update stock/sold-out status.
- Handle support, damage reports, and refund requests.
- Check failed integration events and retry/reconcile safely.

## Incident response
1. Stuck payments: verify webhook ledger, reconcile with Razorpay API, refund or capture as appropriate.
2. Shipment failures: open Shiprocket exception queue, retry or switch courier, notify customer.
3. Webhook errors: alert on repeated failures, replay idempotently from event ledger.
4. Database restore: test restore from automated backups/PITR before relying on it.

## Rollback
- Keep a rollback artifact and database migration recovery plan for every release.
- Deploy backend and storefront in compatible order; run health checks and smoke tests after release.
