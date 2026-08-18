-- Vendor-Centric Workflow Revision: Client Companies & Project Managers
-- Run this against the target MySQL database (see backend/README.md).
--
-- There can be multiple PM users belonging to the same client company
-- (e.g. two PMs both at "Acme Technologies"). company_name previously
-- lived directly on `projects` (see 006_add_project_company_name.sql),
-- but that meant company identity was typed per-project rather than
-- being a real property of the PM's employer, and had no dedup — two
-- projects from the same PM could end up with "Acme" vs "ACME Inc".
--
-- client_companies is the canonical company record. normalized_name
-- (lowercased, trimmed) carries a UNIQUE constraint so signup can
-- find-or-create atomically via
--   INSERT INTO client_companies (name, normalized_name) VALUES (?, ?)
--   ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
-- without a separate read-then-write step that could race under
-- concurrent signups.
--
-- project_managers is a one-row-per-PM association table (user_id is
-- unique — one PM belongs to exactly one company for this MVP) rather
-- than folding company_id directly onto `users`, so that PM-specific
-- fields (department) don't pollute the shared users table used by all
-- three roles.
--
-- projects.company_name (the old column) is NOT dropped — existing
-- projects created before this migration keep displaying correctly via
-- COALESCE(client_companies.name, projects.company_name) in
-- projectRepository; new projects derive company identity from the
-- creating PM's project_managers/client_companies link instead.
--
-- `ADD COLUMN/INDEX IF NOT EXISTS` is a MariaDB-only extension — plain
-- MySQL rejects that syntax outright. New tables use CREATE TABLE IF NOT
-- EXISTS (supported by both engines identically), matching every prior
-- migration in this project.

CREATE TABLE IF NOT EXISTS client_companies (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  name             VARCHAR(150) NOT NULL,
  normalized_name  VARCHAR(150) NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_client_companies_normalized_name (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_managers (
  user_id     INT PRIMARY KEY,
  company_id  INT NOT NULL,
  department  VARCHAR(100) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_project_managers_company_id (company_id),

  CONSTRAINT fk_project_managers_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_project_managers_company FOREIGN KEY (company_id) REFERENCES client_companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
