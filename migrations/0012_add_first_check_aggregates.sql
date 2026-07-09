-- Ticket 3: aggregate-only first-check counters for /update/check.
-- Additive columns on the existing daily row key. No identity, no install ID,
-- no dedupe, no unique-user signal. Exactly one column increments per check.
ALTER TABLE release_update_checks_daily ADD COLUMN first_check_true INTEGER NOT NULL DEFAULT 0;
ALTER TABLE release_update_checks_daily ADD COLUMN first_check_false INTEGER NOT NULL DEFAULT 0;
ALTER TABLE release_update_checks_daily ADD COLUMN first_check_unknown INTEGER NOT NULL DEFAULT 0;
