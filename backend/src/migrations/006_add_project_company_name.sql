-- Module 3 Revision: Project Staffing Requirements, Contractor Skills & Atomic Assignment
-- Run this against the target MySQL database (see backend/README.md).
--
-- There can be multiple PM users belonging to different client companies
-- (PM A @ Acme, PM B @ Contoso, ...). The existing schema has no separate
-- "company"/"client" table, and Module 3's spec explicitly says not to
-- introduce a company-management subsystem for this MVP. company_name
-- belongs most naturally on the project itself: a Vendor browsing
-- projects needs to see which company each project belongs to, and every
-- project already carries the pm_id that created it — company_name is
-- just one more descriptive field on that same row, not a new
-- relationship. Nullable at the column level for backward compatibility
-- with rows created before this migration; new project creation requires
-- it via pmProjectValidators.
--
-- `ADD COLUMN IF NOT EXISTS` is a MariaDB-only extension — plain MySQL
-- rejects that syntax outright. Guarded with an information_schema check
-- + PREPARE/EXECUTE instead, which both engines support.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'company_name'
);
SET @add_col_sql := IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN company_name VARCHAR(150) NULL AFTER description',
  'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
