-- Module 4/5/6 Redesign: Project-Level Hours, Allocation & Milestones
-- Run this against the target MySQL database (see backend/README.md).
--
-- This migration does NOT touch 001-015. It is written with the same
-- information_schema + PREPARE/EXECUTE portability guard every ALTER in
-- this project already uses (005/006/008/011/013), so it is safe to
-- re-run against a database that already has some or all of it applied.
--
-- ============================================================
-- 1. projects.expected_hours
-- ============================================================
-- Total hours capacity for the whole project (all contractors combined).
-- Nullable at the column level for backward compatibility with rows
-- created before this migration (same pattern as projects.company_name
-- in migration 006) — enforced NOT NULL / positive / non-zero at the
-- application layer for NEW projects (pmProjectValidators), never as a
-- DB-level NOT NULL, so this migration never fails against existing rows.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'expected_hours'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN expected_hours DECIMAL(9,2) NULL AFTER end_date',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. project_assignments: allocated_hours, status, released_at
-- ============================================================
-- allocated_hours: how many of the project's expected_hours this specific
-- assignment is staffed for. Nullable for legacy rows created before this
-- migration (headcount-only assignments, see migration 004/008) — treated
-- as 0 by every SUM in the application layer (COALESCE), so pre-existing
-- assignments never silently count against a project's new capacity
-- limit. New assignments (vendorAssignmentService) always supply a
-- positive value.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND COLUMN_NAME = 'allocated_hours'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE project_assignments ADD COLUMN allocated_hours DECIMAL(9,2) NULL AFTER requirement_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- status: an assignment is never deleted when a contractor's work on a
-- project ends — it transitions ACTIVE -> RELEASED instead, preserving it
-- for billing/audit/reporting history (spec requirement). Legacy rows
-- default to ACTIVE (they were never released under the old model).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND COLUMN_NAME = 'status'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE project_assignments ADD COLUMN status ENUM(''ACTIVE'',''RELEASED'') NOT NULL DEFAULT ''ACTIVE'' AFTER allocated_hours',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND COLUMN_NAME = 'released_at'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE project_assignments ADD COLUMN released_at TIMESTAMP NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. Replace the old "one contractor, one project, EVER" constraint
-- ============================================================
-- Migration 011 added a plain UNIQUE(contractor_id) because, at the time,
-- there was no "release" action — assigned-once meant assigned-forever.
-- Now that RELEASED exists, a contractor must become eligible for a NEW
-- assignment again after being released from their previous one, while
-- still being restricted to at most ONE *ACTIVE* assignment at a time.
-- A plain UNIQUE(contractor_id) can no longer express that (it would
-- permanently block reassignment even after release).
--
-- Fix: a generated STORED column that is the contractor_id when the row
-- is ACTIVE and NULL otherwise, with a UNIQUE index on that generated
-- column. Both MySQL (5.7.6+) and MariaDB (5.2+) treat NULL as
-- non-colliding in a UNIQUE index (standard SQL semantics), so any number
-- of RELEASED rows for the same contractor coexist freely, while at most
-- one ACTIVE row per contractor can ever exist — enforced by the database
-- itself, not just application-level locking (though the assignment
-- transaction still locks the contractor row first, same defense-in-depth
-- pattern as every other constraint in this codebase).
SET @old_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND INDEX_NAME = 'uq_assignment_contractor'
);
SET @drop_old_idx_sql := IF(@old_idx_exists > 0,
  'ALTER TABLE project_assignments DROP INDEX uq_assignment_contractor',
  'SELECT 1'
);
PREPARE stmt FROM @drop_old_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND COLUMN_NAME = 'active_contractor_key'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE project_assignments ADD COLUMN active_contractor_key INT GENERATED ALWAYS AS (IF(status = ''ACTIVE'', contractor_id, NULL)) STORED AFTER released_at',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @new_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND INDEX_NAME = 'uq_assignment_active_contractor'
);
SET @add_idx_sql := IF(@new_idx_exists = 0,
  'ALTER TABLE project_assignments ADD CONSTRAINT uq_assignment_active_contractor UNIQUE (active_contractor_key)',
  'SELECT 1'
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 4. milestones: drop the per-contractor scope entirely
-- ============================================================
-- A milestone becomes a pure PROJECT-wide checkpoint (see
-- milestoneService.checkAndTriggerMilestones). Order matters: drop the FK
-- before the column it constrains, drop the composite index that embeds
-- the column before the column, then add the new project-only index.
--
-- DOCUMENTED CAVEAT (per the migration-strategy requirement to note what
-- cannot be reconstructed): if a database being migrated already has
-- MULTIPLE per-contractor milestone rows for the same project that
-- happen to share the same threshold_hours (created under the old
-- one-milestone-per-contractor model, e.g. "M1 = 50h" created once for
-- each of several contractors on the same project), those rows are NOT
-- merged or deduplicated by this migration — each becomes its own
-- project-level milestone row after contractor_id is dropped, and
-- checkAndTriggerMilestones will evaluate each independently. No rows are
-- deleted (any already-MET milestone's billing/invoice history is fully
-- preserved via milestone_billings/invoices, untouched by this
-- migration), but such duplicates are a pre-existing-data cleanup item
-- for whoever owns that data, not something this migration can safely
-- infer and silently resolve. This environment's database is freshly
-- migrated with no such legacy rows.
-- Step 4a: add the replacement (project_id, status) index FIRST — the
-- existing idx_milestones_project_contractor_status is the only index
-- with project_id as a leftmost prefix, which means InnoDB is silently
-- relying on it to support fk_milestones_project too (not just
-- fk_milestones_contractor). Dropping it before a replacement exists
-- fails with "needed in a foreign key constraint" — same add-then-drop
-- ordering reasoning as migration 013's index rename.
SET @new_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'milestones' AND INDEX_NAME = 'idx_milestones_project_status'
);
SET @add_idx_sql := IF(@new_idx_exists = 0,
  'ALTER TABLE milestones ADD INDEX idx_milestones_project_status (project_id, status)',
  'SELECT 1'
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4b: now safe to drop the contractor FK (its own single-column
-- support index, auto-created by InnoDB alongside fk_milestones_contractor
-- in migration 014, is unaffected by the project_id index change above).
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'milestones'
    AND CONSTRAINT_NAME = 'fk_milestones_contractor' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @drop_fk_sql := IF(@fk_exists > 0,
  'ALTER TABLE milestones DROP FOREIGN KEY fk_milestones_contractor',
  'SELECT 1'
);
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4c: now safe to drop the old composite index — the new
-- (project_id, status) index already supports fk_milestones_project, and
-- the FK on contractor_id is already gone.
SET @old_idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'milestones' AND INDEX_NAME = 'idx_milestones_project_contractor_status'
);
SET @drop_idx_sql := IF(@old_idx_exists > 0,
  'ALTER TABLE milestones DROP INDEX idx_milestones_project_contractor_status',
  'SELECT 1'
);
PREPARE stmt FROM @drop_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4d: drop the now-unreferenced column itself. This also drops
-- InnoDB's auto-created single-column support index for the FK dropped
-- in 4b (that index existed only to support a FK that no longer exists).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'milestones' AND COLUMN_NAME = 'contractor_id'
);
SET @drop_col_sql := IF(@col_exists > 0,
  'ALTER TABLE milestones DROP COLUMN contractor_id',
  'SELECT 1'
);
PREPARE stmt FROM @drop_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 5. milestone_billings / invoices — NO schema change
-- ============================================================
-- milestone_billings (migration 014) already has exactly the shape this
-- redesign needs for a "milestone_contributions" ledger: milestone_id,
-- contractor_id, approved_hours, hourly_rate, billing_amount, created_at,
-- with UNIQUE(milestone_id, contractor_id) — under the OLD model that
-- meant "one bill per milestone, and a milestone only ever had one
-- contractor"; under the NEW model it means "one contribution row per
-- milestone per contributing contractor," which is exactly the
-- constraint a multi-contractor milestone needs. Renaming the table would
-- require re-pointing invoices.milestone_billing_id's FK for no
-- functional gain, so it keeps its name — see milestoneService.js and
-- STEP2_STEP3_PLAN.md for this decision spelled out explicitly.
--
-- invoices (migration 015) already generates exactly one invoice per
-- milestone_billing_id (UNIQUE constraint), which — now that a billing
-- row is per-contractor-per-milestone — already means "one invoice per
-- contributing contractor per milestone," satisfying the spec's separate-
-- invoice-per-contractor requirement with zero schema change.
