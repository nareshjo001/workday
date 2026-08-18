-- Module 3 Revision: Project Staffing Requirements, Contractor Skills & Atomic Assignment
-- Run this against the target MySQL database (see backend/README.md).
--
-- Adds a single primary skill to each contractor. This is a DIFFERENT
-- concept from users.role (VENDOR/CONTRACTOR/PM — "what type of VMS user
-- are you") — contractors.skill answers "what work can this contractor
-- perform" and is what a project_requirements row is matched against.
--
-- MVP: one contractor = one primary skill (nullable — a contractor can
-- exist and log in before ever setting one; see contractorProfileService).
-- Multi-skill support is explicitly out of scope for this revision.
--
-- `ADD COLUMN/INDEX IF NOT EXISTS` is a MariaDB-only extension — plain
-- MySQL rejects that syntax outright. Guarded with an information_schema
-- check + PREPARE/EXECUTE instead, which both engines support, so this
-- migration is safe to re-run regardless of which one the target
-- database is.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contractors' AND COLUMN_NAME = 'skill'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE contractors ADD COLUMN skill ENUM(''FRONTEND'', ''BACKEND'', ''QA'', ''DEVOPS'', ''DATA'') NULL AFTER hourly_rate',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contractors' AND INDEX_NAME = 'idx_contractors_skill'
);
SET @add_idx_sql := IF(@idx_exists = 0,
  'ALTER TABLE contractors ADD INDEX idx_contractors_skill (skill)',
  'SELECT 1'
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
