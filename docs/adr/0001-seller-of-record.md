# ADR-0001: Seller of record model

## Status
Proposed

## Context
SnehaVrinda Kala works with artists and craft partners. The plan (Section 4.1) recommends a centrally managed curated brand launch model where SnehaVrinda Kala controls the customer experience, product approval, pricing rules, order support, and fulfilment promise.

Three commercial structures were identified (Section 4.1):
1. SnehaVrinda Kala buys/commissions products and resells as seller of record.
2. Curated consignment/commission arrangement with defined seller/invoicing responsibilities.
3. Independent artist is the seller; platform facilitates (triggers e-commerce-operator/TCS analysis).

## Decision
SnehaVrinda Kala is the seller of record for all launch products. Artists/partners are onboarded through written agreements. The exact legal seller-of-record and invoicing arrangement must be set with a CA/lawyer before the first commercial sale.

## Rationale
- Avoids unrestricted self-serve seller registration and automated split settlements before the operating model is proven.
- Reduces complexity around product quality, refunds, consumer support, tax, seller verification, and fund flows.
- Marketplace seller flows (Stage D/E) are deferred until legal, tax, and payment-provider eligibility is validated.

## Consequences
- Platform issues customer invoices and handles tax/credit notes.
- Partner fees/commissions are tracked in the internal earnings ledger (not automated payouts at launch).
- CA/legal review required before any independent seller checkout is activated.

## Related
ADR-0002 (artist vs independent seller), ADR-0005 (payout model)
