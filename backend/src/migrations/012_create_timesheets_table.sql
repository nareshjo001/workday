-- Module 4: Timesheet Logging & Approval
-- Run this against the target MySQL database (see backend/README.md).
--
-- A contractor logs hours worked in a given week against a project they
-- are actually assigned to (project_assignments — see migration 004/011:
-- one contractor has at most one project, ever, so "assigned to this
-- project" is unambiguous). A PM who owns that project (projects.pm_id)
-- reviews the submission and approves or rejects it.
--
-- contractor_id -> contractors.id (the contractor who logged the hours)
-- project_id    -> projects.id (the project the hours were worked on)
-- reviewed_by   -> users.id, NOT project_managers.id. project_managers
--   (migration 009) is a one-row-per-PM association table whose PRIMARY
--   KEY is user_id — it has no separate `id` column at all, so an FK to
--   "project_managers.id" cannot exist. A PM's identity is their
--   users.id (role = PM), resolved from the authenticated JWT — the same
--   convention projects.pm_id already uses (see migration 003). This
--   column follows that existing convention rather than introducing a
--   column that doesn't exist on the referenced table.
--
-- UNIQUE(contractor_id, project_id, week_start_date) is the actual
-- "no duplicate submission for the same project+week" guarantee — same
-- pattern as UNIQUE(contractor_id, project_id) on project_assignments
-- (migration 004): the application layer also checks first for a clean
-- 409, but the constraint is what's actually relied on under concurrent
-- requests.
--
-- idx_timesheets_project_status supports the PM "pending timesheets for
-- my projects" query (WHERE p.pm_id = ? filters via the projects table's
-- own idx_projects_pm_id, then joins into timesheets on project_id and
-- filters status = 'PENDING' — this composite index serves that join +
-- filter directly, since project_id is not the leftmost column of the
-- UNIQUE key above).
--
-- New table, so a plain CREATE TABLE IF NOT EXISTS is sufficient and
-- safe to re-run — no ALTER-table MySQL/MariaDB portability guard is
-- needed here (that guard, used in migrations 005/006/008/011, is only
-- required for ADD COLUMN/INDEX/CONSTRAINT IF NOT EXISTS, which is a
-- MariaDB-only extension; CREATE TABLE IF NOT EXISTS is supported
-- identically by both engines and is what every other new-table
-- migration in this project already uses).

CREATE TABLE IF NOT EXISTS timesheets (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id    INT NOT NULL,
  project_id       INT NOT NULL,
  week_start_date  DATE NOT NULL,
  hours_logged     DECIMAL(5,2) NOT NULL,
  status           ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  submitted_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by      INT NULL,
  reviewed_at      TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_timesheets_contractor_project_week (contractor_id, project_id, week_start_date),
  INDEX idx_timesheets_project_status (project_id, status),
  INDEX idx_timesheets_reviewed_by (reviewed_by),

  CONSTRAINT fk_timesheets_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  CONSTRAINT fk_timesheets_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_timesheets_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
