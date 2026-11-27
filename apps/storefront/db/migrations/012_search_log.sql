-- Additive migration: what people looked for.
--
-- Nothing recorded search. A studio selling one-of-one works has no sales history
-- to mine for demand, so the shop's own search box is the cheapest research it
-- will ever get: every query is somebody saying what they hoped to buy. A query
-- that returned nothing is an instruction, not a failure.
--
-- Deliberately small and unlinked: no session id, no IP, no customer id. The
-- question being asked is "what words", and a table that cannot answer "who" is a
-- table that cannot become a privacy problem.

CREATE TABLE IF NOT EXISTS search_log (
  id         bigserial PRIMARY KEY,
  query      text        NOT NULL,
  locale     text        NOT NULL DEFAULT 'en',
  results    integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The two reports both read the recent window, newest first.
CREATE INDEX IF NOT EXISTS search_log_created_at_idx ON search_log (created_at DESC);
CREATE INDEX IF NOT EXISTS search_log_results_idx ON search_log (results);
