-- Module 3 Revision: Project Staffing Requirements, Contractor Skills & Atomic Assignment
-- Run this against the target MySQL database (see backend/README.md).
--
-- A project's staffing plan: how many contractors of each skill it needs.
-- One row per (project_id, skill) — UNIQUE constraint below also enforces
-- "no duplicate skill requirement on the same project" at the database
-- level, on top of the application-level validation in
-- pmProjectValidators.
--
-- Overall staffing progress/status is NOT stored here or anywhere else —
-- it's derived at read time from required_count vs. the count of
-- project_assignments rows pointing at each requirement (see
-- assignmentRepository / pmProjectService). Storing a derived value would
-- just be one more place it could drift out of sync with the source data.

CREATE TABLE IF NOT EXISTS project_requirements (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  project_id      INT NOT NULL,
  skill           ENUM('FRONTEND', 'BACKEND', 'QA', 'DEVOPS', 'DATA') NOT NULL,
  required_count  INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_requirement_project_skill (project_id, skill),
  INDEX idx_requirements_project_id (project_id),

  CONSTRAINT fk_requirements_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
