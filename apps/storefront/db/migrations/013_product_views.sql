-- Additive migration: what was looked at, counted by day.
--
-- Half the shop's visitors never search and never buy; they open a work and leave.
-- Without a view count the studio cannot tell a work nobody notices from a work
-- everybody admires and nobody can afford — and those two call for opposite
-- decisions about price, photographs and where a work is placed in the shop.
--
-- Rolled up per day rather than stored per visit: one row per work per day means
-- the table stays small forever, and nobody's path through the shop is recorded.

CREATE TABLE IF NOT EXISTS product_view (
  handle text NOT NULL,
  day    date NOT NULL DEFAULT current_date,
  views  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (handle, day)
);

CREATE INDEX IF NOT EXISTS product_view_day_idx ON product_view (day DESC);
