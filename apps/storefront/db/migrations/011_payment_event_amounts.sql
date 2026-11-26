-- What a payment event was worth.
--
-- `payment_event` recorded that something happened — captured, failed, refunded —
-- but not how much. Anyone reconciling by hand could see six events and no
-- money, and would have to open the Razorpay dashboard to find out whether a
-- failure was a ₹1 test or a ₹40,000 commission.
--
-- These are snapshots of what the webhook claimed, not the source of truth. The
-- provider fetch still decides whether money moved; these columns exist so the
-- record can answer "how much" without a second API call and without a guess.
--
-- Amounts are in the provider's minor units (paise), matching `processed_payments`
-- and the Razorpay payload, so no conversion sits between the record and the
-- receipt.

ALTER TABLE payment_event ADD COLUMN IF NOT EXISTS amount numeric(14, 2);
ALTER TABLE payment_event ADD COLUMN IF NOT EXISTS currency text;

CREATE INDEX IF NOT EXISTS idx_payment_event_type ON payment_event (event_type);
CREATE INDEX IF NOT EXISTS idx_payment_event_received ON payment_event (received_at DESC);
