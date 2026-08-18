-- Module 3 Revision: Project Staffing Requirements, Contractor Skills & Atomic Assignment
-- Run this against the target MySQL database (see backend/README.md).
--
-- Links each assignment to the specific project_requirements row it fills.
-- This is captured at assignment time rather than recomputed later so
-- that a contractor changing their skill AFTER being assigned can never
-- retroactively change what an existing assignment counts against (see
-- "Real-world edge cases" in the Module 3 revision spec: skill changes
-- affect only FUTURE assignments). It's also what the atomic assignment
-- transaction locks via `SELECT ... FOR UPDATE` to prevent over-allocation
-- under concurrent requests (see assignmentRepository.lockRequirementForUpdate).
--
-- Nullable: assignments created before this migration (Module 3's first
-- version, before staffing requirements existed) have no requirement to
-- point at and are left as legacy NULL rows rather than backfilled with a
-- guess.
--
-- `ADD COLUMN/INDEX/CONSTRAINT IF NOT EXISTS` is either a MariaDB-only
-- extension or (for FOREIGN KEY specifically) not supported by MariaDB
-- either — plain MySQL rejects the IF NOT EXISTS form outright for all
-- three. Every ALTER below is guarded with an information_schema check +
-- PREPARE/EXECUTE instead, which both engines support identically, so
-- this migration is safe to re-run regardless of which one the target
-- database is.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND COLUMN_NAME = 'requirement_id'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE project_assignments ADD COLUMN requirement_id INT NULL AFTER project_id',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_assignments' AND INDEX_NAME = 'idx_assignments_requirement_id'
);
SET @add_idx_sql := IF(@idx_exists = 0,
  'ALTER TABLE project_assignments ADD INDEX idx_assignments_requirement_id (requirement_id)',
  'SELECT 1'
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_assignments'
    AND CONSTRAINT_NAME = 'fk_assignments_requirement'
);
SET @add_fk_sql := IF(@fk_exists = 0,
  'ALTER TABLE project_assignments ADD CONSTRAINT fk_assignments_requirement FOREIGN KEY (requirement_id) REFERENCES project_requirements(id)',
  'SELECT 1'
);
PREPARE stmt FROM @add_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
