# ADR-0002: Razorpay as the payment provider (Medusa custom provider)

## Status
Proposed

## Context
The plan selects Razorpay for payments (UPI/cards/net banking), implemented as a Medusa Payment Module Provider (Section 12.2). Razorpay merchant approval and current API terms must be confirmed before implementation.

## Decision
Implement and test a Medusa Payment Module Provider that maps Medusa payment lifecycle methods to Razorpay APIs. Use test keys first; switch to live keys only after merchant eligibility is confirmed.

## Key requirements
- Create a provider payment order/session for a Medusa cart/order.
- Open Razorpay checkout UI without collecting/storing raw card credentials.
- Verify payment callback signatures server-side (HMAC-SHA256 over raw body, X-Razorpay-Signature header).
- Verify provider payment state with authenticated API calls.
- Receive payment/failure/refund/dispute webhooks idempotently (store provider event ID).
- Support full and partial refunds where allowed.
- Reconcile captured amount, currency, provider ID, Medusa order, refunds, fees, settlement references.

## Critical rule
A successful browser redirect is not payment proof. Mark the order paid only after valid server-side verification/provider state confirmation. Handle out-of-order and duplicate webhook events safely.

## Consequences
- Webhook endpoint must validate signatures before processing.
- Integration event ledger required for idempotency and reconciliation.
- Test in staging with Razorpay sandbox before enabling live events.
- Razorpay Route (linked accounts/transfers) is deferred to a later marketplace stage.
