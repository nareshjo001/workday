-- Module 4 Revision: Daily Timesheet Logging (weekly totals -> one row per day)
-- Run this against the target MySQL database (see backend/README.md).
--
-- Module 4 originally stored ONE ROW PER WEEK (week_start_date, a Monday,
-- with hours_logged as that week's total). This revision changes the
-- data model to ONE ROW PER DAY (work_date, any calendar day, with
-- hours_logged as that single day's hours) so a contractor can log and a
-- PM can approve/reject individual days rather than an entire week at
-- once. The weekly view contractors/PMs still see in the UI is now
-- computed by grouping these daily rows client-side (see
-- frontend/src/components/timesheets/weekGrouping.js) — there is no
-- weekly-total column anywhere in this table anymore.
--
-- WHY A COLUMN RENAME, NOT A NEW TABLE: every existing row already
-- represents "hours worked, dated to a single DATE value" — only the
-- MEANING of that date changes (week-start vs. the actual day worked).
-- Renaming week_start_date -> work_date via CHANGE COLUMN preserves every
-- existing row's id, contractor_id, project_id, status, submitted_at,
-- reviewed_by/reviewed_at exactly as they were; nothing is dropped or
-- reconstructed.
--
-- DOCUMENTED LIMITATION (explicitly not worked around): a pre-existing
-- weekly-total row cannot be split into its true daily breakdown — the
-- old model never captured which of the 7 days the hours were actually
-- worked on, or how they were distributed across the week. Inventing
-- that breakdown (e.g. dividing the weekly total by 7) would fabricate
-- data that was never reported. Per the revision spec, this migration
-- does NOT do that. Instead, each pre-existing row keeps its original
-- date value (formerly "the Monday that started the week", now read as
-- "the work_date") and keeps its original hours_logged value (formerly
-- "that week's total", now read as "that day's hours"). In effect, a
-- legacy row reads as if the contractor's entire reported week of work
-- was logged as a single day entry dated to that week's Monday. This is
-- why the new app-level 24-hour/day validation cap (see
-- contractorTimesheetValidators.MAX_HOURS_PER_DAY) is enforced only for
-- NEW submissions going forward, not as a DB CHECK constraint — a
-- CHECK(hours_logged <= 24) here would reject re-saving perfectly valid
-- historical rows that legitimately hold a pre-revision weekly total
-- above 24. Anyone auditing old data should expect to see a handful of
-- rows with hours_logged in the 25-168 range, all with a Monday
-- work_date, and can tell them apart from genuine daily entries that
-- way if needed.
--
-- UNIQUE(contractor_id, project_id, work_date) replaces
-- UNIQUE(contractor_id, project_id, week_start_date) as the real
-- "no duplicate submission for the same project+day" guarantee (same
-- role the old constraint played for project+week — see migration 012).
-- MySQL/MariaDB auto-update an index's definition when CHANGE COLUMN
-- renames one of its columns, but NOT the index's own name — so right
-- after the rename below, `uq_timesheets_contractor_project_week` is
-- already (confusingly) enforcing uniqueness on work_date. This
-- migration adds a correctly-named replacement FIRST and drops the old
-- one SECOND, rather than using `ALTER TABLE ... RENAME INDEX`
-- (a rename-in-place primitive that would avoid needing two steps at
-- all), because RENAME INDEX requires MySQL 5.7+/MariaDB 10.5.2+ and
-- this project's other ALTERs (005/006/008/011) are deliberately written
-- to the lowest-common-denominator information_schema + PREPARE/EXECUTE
-- pattern for portability. The add-then-drop order (not drop-then-add)
-- is not just cosmetic: fk_timesheets_contractor (contractor_id) has no
-- OTHER index anywhere on this table with contractor_id as a leftmost
-- column, so InnoDB refuses to drop uq_timesheets_contractor_project_week
-- while it is the only index still supporting that foreign key. Creating
-- uq_timesheets_contractor_project_date first (same columns, contractor_id
-- still leftmost) gives InnoDB a replacement to fall back the FK onto,
-- so the old index can then be dropped cleanly with no gap where the
-- table is missing either the uniqueness guarantee or valid FK support.
--
-- updated_at is new: an edit to a REJECTED log (the new
-- PATCH /api/contractor/timesheets/:id endpoint) needs its own
-- last-modified timestamp distinct from submitted_at (which the edit
-- also refreshes, since an edited-and-resubmitted log is re-entering the
-- PM's PENDING queue) and reviewed_at (cleared back to NULL on edit).
-- ON UPDATE CURRENT_TIMESTAMP keeps it accurate through both the
-- original submission and any later edit with zero application code.
--
-- `ADD/DROP ... IF NOT EXISTS` is a MariaDB-only extension — plain MySQL
-- rejects that syntax outright. Every step below is guarded with an
-- information_schema check + PREPARE/EXECUTE instead (same pattern as
-- migrations 005/006/008/011), so this migration is idempotent and safe
-- to re-run regardless of which engine the target database is, and safe
-- to run against a fresh database that already has migration 012's
-- original column layout un-applied in any partial way.

-- Step 1: rename week_start_date -> work_date, preserving every existing
-- value and every other column untouched.
SET @col_week_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timesheets' AND COLUMN_NAME = 'week_start_date'
);
SET @col_work_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timesheets' AND COLUMN_NAME = 'work_date'
);
SET @rename_col_sql := IF(@col_week_exists = 1 AND @col_work_exists = 0,
  'ALTER TABLE timesheets CHANGE COLUMN week_start_date work_date DATE NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @rename_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: add the correctly-named replacement FIRST (see the comment
-- above for why this must happen before the drop, not after).
SET @new_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timesheets'
    AND INDEX_NAME = 'uq_timesheets_contractor_project_date'
);
SET @add_new_idx_sql := IF(@new_idx_exists = 0,
  'ALTER TABLE timesheets ADD CONSTRAINT uq_timesheets_contractor_project_date UNIQUE (contractor_id, project_id, work_date)',
  'SELECT 1'
);
PREPARE stmt FROM @add_new_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: drop the old (now misnamed, now redundant) unique key, if
-- present.
SET @old_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timesheets'
    AND INDEX_NAME = 'uq_timesheets_contractor_project_week'
);
SET @drop_old_idx_sql := IF(@old_idx_exists > 0,
  'ALTER TABLE timesheets DROP INDEX uq_timesheets_contractor_project_week',
  'SELECT 1'
);
PREPARE stmt FROM @drop_old_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: add updated_at, if not already present.
SET @col_updated_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timesheets' AND COLUMN_NAME = 'updated_at'
);
SET @add_updated_sql := IF(@col_updated_exists = 0,
  'ALTER TABLE timesheets ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT 1'
);
PREPARE stmt FROM @add_updated_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
