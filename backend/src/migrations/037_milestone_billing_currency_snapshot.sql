-- Preserve the assignment currency alongside every immutable milestone
-- billing contribution. Historical rows predate multi-currency propagation
-- and retain the application's former USD behavior.
ALTER TABLE milestone_billings
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER hourly_rate;
