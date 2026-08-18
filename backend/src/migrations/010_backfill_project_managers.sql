-- Vendor-Centric Workflow Revision: Backfill Client Companies & Project Managers
-- Run this against the target MySQL database (see backend/README.md).
--
-- 009 created the client_companies/project_managers tables, but PM users
-- created before this revision have no project_managers row yet — their
-- company identity previously lived only on individual projects.company_name
-- (see 006). This migration links each such PM to a client company:
--   - if they have at least one project with a company_name set, reuse (or
--     create) a client_companies row for their MOST RECENT project's
--     company_name;
--   - otherwise (no projects yet, or projects with no company_name), link
--     them to a shared "Unknown Company" placeholder so every PM has a
--     company going forward.
--
-- Idempotent: every statement below only touches PM users that don't
-- already have a project_managers row (LEFT JOIN ... IS NULL / anti-join),
-- so re-running this migration after it has already applied is a no-op.
-- No plain MySQL/MariaDB portability concerns here — these are ordinary
-- INSERT...SELECT statements, not ALTER TABLE, so no IF NOT EXISTS /
-- PREPARE guard is needed.
--
-- The company-name-picking SELECT below wraps p.company_name in MIN() —
-- with ONLY_FULL_GROUP_BY (MySQL's default sql_mode, not the sandbox
-- MariaDB's default, which is how this slipped through the first pass)
-- a column selected alongside a GROUP BY expression it isn't functionally
-- dependent on must go through an aggregate function. Several
-- differently-cased company_name spellings can collapse onto the same
-- normalized_name, so there's no single "correct" original casing to
-- pick — MIN() just deterministically picks one (lexicographically
-- smallest) rather than leaving it to MySQL's arbitrary choice.

-- Ensure the fallback company exists.
INSERT INTO client_companies (name, normalized_name)
SELECT 'Unknown Company', 'unknown company'
WHERE NOT EXISTS (
  SELECT 1 FROM client_companies WHERE normalized_name = 'unknown company'
);

-- Create a client company for every distinct project company_name
-- belonging to a not-yet-linked PM, that doesn't already have one.
INSERT INTO client_companies (name, normalized_name)
SELECT x.name, x.normalized_name FROM (
  SELECT MIN(p.company_name) AS name, LOWER(TRIM(p.company_name)) AS normalized_name
  FROM projects p
  JOIN users u ON u.id = p.pm_id
  LEFT JOIN project_managers pm ON pm.user_id = u.id
  WHERE pm.user_id IS NULL
    AND p.company_name IS NOT NULL
    AND TRIM(p.company_name) <> ''
  GROUP BY LOWER(TRIM(p.company_name))
) x
WHERE NOT EXISTS (
  SELECT 1 FROM client_companies cc WHERE cc.normalized_name = x.normalized_name
);

-- Link every not-yet-linked PM to their most recent project's company,
-- falling back to "Unknown Company" if they have none.
INSERT INTO project_managers (user_id, company_id)
SELECT
  u.id,
  COALESCE(
    (
      SELECT cc.id
      FROM projects p
      JOIN client_companies cc ON cc.normalized_name = LOWER(TRIM(p.company_name))
      WHERE p.pm_id = u.id
        AND p.company_name IS NOT NULL
        AND TRIM(p.company_name) <> ''
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 1
    ),
    (SELECT id FROM client_companies WHERE normalized_name = 'unknown company')
  ) AS company_id
FROM users u
LEFT JOIN project_managers pm ON pm.user_id = u.id
WHERE u.role = 'PM' AND pm.user_id IS NULL;
