-- Vendor-Centric Workflow Revision: One Contractor, One Project (Ever)
-- Run this against the target MySQL database (see backend/README.md).
--
-- New business rule: a contractor can be assigned to at most one project
-- at a time. Since this MVP has no "unassign" action, "at a time" and
-- "ever" are the same thing for now — so the simplest correct DB-level
-- guarantee is a UNIQUE constraint on project_assignments.contractor_id
-- alone (in addition to the existing UNIQUE(contractor_id, project_id)
-- from 004_create_project_assignments_table.sql, which only prevented
-- assigning the SAME contractor to the SAME project twice). This is what
-- actually stops a second, concurrent assignment attempt from succeeding
-- even if the application-level "already assigned anywhere" check in
-- vendorAssignmentService raced with it — the earlier check-then-insert
-- pattern for the old per-project rule already relied on the DB
-- constraint as the real guarantee, not the app-level check alone; this
-- migration just tightens which rows collide.
--
-- IMPORTANT SIDE EFFECT: earlier Module 3 revision testing created test
-- data with some contractors assigned to more than one project (that was
-- valid under the OLD rule). Adding a UNIQUE(contractor_id) constraint
-- directly against that data would fail with a duplicate-key error, so
-- this migration first deletes the extra assignment rows for any
-- contractor assigned to more than one project, keeping only the
-- earliest (lowest id / first-assigned) row and deleting the rest. This
-- IS a real data deletion, called out explicitly in the report — it only
-- affects contractors who (under the old, now-superseded rule) had
-- multiple simultaneous assignments; every contractor keeps their single
-- oldest assignment.
--
-- `ADD CONSTRAINT/INDEX IF NOT EXISTS` is a MariaDB-only extension —
-- plain MySQL rejects that syntax outright. The ALTER below is guarded
-- with an information_schema check + PREPARE/EXECUTE, same pattern as
-- 005/006/008, so this migration is safe to re-run regardless of engine.
-- The DELETE step is naturally idempotent: once only one row per
-- contractor_id remains, the join condition (pa1.id > pa2.id for the
-- same contractor_id) matches nothing on a second run.

DELETE pa1 FROM project_assignments pa1
JOIN project_assignments pa2
  ON pa1.contractor_id = pa2.contractor_id
  AND pa1.id > pa2.id;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_assignments'
    AND INDEX_NAME = 'uq_assignment_contractor'
);
SET @add_idx_sql := IF(@idx_exists = 0,
  'ALTER TABLE project_assignments ADD CONSTRAINT uq_assignment_contractor UNIQUE (contractor_id)',
  'SELECT 1'
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
