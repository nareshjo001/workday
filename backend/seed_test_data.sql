-- ============================================================================
-- WorkDay VMS — Referentially-consistent test data seed script
-- ============================================================================
-- Purpose: populate every table with a small, internally-consistent dataset
-- so the Vendor / PM / Contractor dashboards (and the rest of the app) have
-- real numbers to render instead of empty states.
--
-- Login for every seeded user: password  Password123!
-- (the password_hash values below are real bcryptjs hashes of that string,
-- generated with the app's own bcrypt.hash(plain, 10) — you can log into the
-- running app UI with any of the emails below and that password.)
--
-- Scenario summary (2 companies, 2 PMs, 2 vendors, 5 contractors, 4 projects):
--   Acme Technologies — PM Alice
--     Payments API            ACTIVE,    ends in 9 days   (tests "approaching end date")
--     Mobile App Revamp       COMPLETED
--     Legacy Portal Overdue   ACTIVE,    end date already passed, UNSTAFFED
--                                        (tests "pending staffing" + "past end date, still active")
--   Globex Corp — PM Bob
--     Data Pipeline Modernization  ACTIVE
--   Vendor Sam  -> contractors C1 (FRONTEND), C2 (BACKEND), C3 (QA, released)
--   Vendor Tina -> contractors C4 (DEVOPS), C5 (DATA)
--
-- Invoice/earnings coverage (deliberately exercises the "earned excludes
-- PENDING_REVIEW/REJECTED" rule from three different angles):
--   C3 (vendor Sam)  -> APPROVED invoice, 2000.00      => counts as earned
--   C4 (vendor Tina) -> PENDING_REVIEW invoice, 1760.00 => NOT earned yet
--   C5 (vendor Tina) -> REJECTED invoice, 1300.00       => NOT earned
--   C1, C2 (vendor Sam) -> milestone still PENDING, no invoice yet at all
--
-- All FK references below are resolved by natural key (email / name) via
-- subqueries rather than hard-coded IDs, so this script is safe to run
-- against a database that already has other data in it — it never assumes
-- particular AUTO_INCREMENT values. Every generated/derived column
-- (project_assignments.active_contractor_key) is deliberately left out of
-- every INSERT's column list, since MySQL/MariaDB computes it automatically
-- and rejects an explicit value for a STORED GENERATED column.
--
-- Safe to re-run: if you need a clean slate first, see the DELETE block at
-- the very bottom of this file (commented out) which removes only rows
-- belonging to these seed emails/companies, leaving all other data intact.
-- ============================================================================

START TRANSACTION;

-- ----------------------------------------------------------------------------
-- 1. users  (2 PMs, 2 vendors, 5 contractor logins)
-- ----------------------------------------------------------------------------
-- password_hash is bcryptjs.hash('Password123!', 10) for every row.
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Alice Reyes',   'seed.pm.alice@test.com',        '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'PM'),
  ('Bob Chen',      'seed.pm.bob@test.com',          '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'PM'),
  ('Sam Patel',     'seed.vendor.sam@test.com',      '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'VENDOR'),
  ('Tina Wong',     'seed.vendor.tina@test.com',     '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'VENDOR'),
  ('Nina Cole',     'seed.contractor.c1@test.com',   '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'CONTRACTOR'),
  ('Omar Silva',    'seed.contractor.c2@test.com',   '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'CONTRACTOR'),
  ('Priya Nair',    'seed.contractor.c3@test.com',   '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'CONTRACTOR'),
  ('Derek Kim',     'seed.contractor.c4@test.com',   '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'CONTRACTOR'),
  ('Elena Ruiz',    'seed.contractor.c5@test.com',   '$2a$10$8dL7ZmV2j5O1tqtY6XmchO9YEVnHLl4GGK859GS39Et3/15TufAZ.', 'CONTRACTOR');

-- ----------------------------------------------------------------------------
-- 2. client_companies
-- ----------------------------------------------------------------------------
INSERT INTO client_companies (name, normalized_name) VALUES
  ('Acme Technologies', 'acme technologies'),
  ('Globex Corp',       'globex corp');

-- ----------------------------------------------------------------------------
-- 3. project_managers  (links each PM user to their company)
-- ----------------------------------------------------------------------------
INSERT INTO project_managers (user_id, company_id, department) VALUES
  ((SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'),
   (SELECT id FROM client_companies WHERE normalized_name = 'acme technologies'),
   'Engineering'),
  ((SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'),
   (SELECT id FROM client_companies WHERE normalized_name = 'globex corp'),
   'Operations');

-- ----------------------------------------------------------------------------
-- 4. contractors  (one row per contractor login, owned by a vendor)
-- ----------------------------------------------------------------------------
INSERT INTO contractors (user_id, vendor_id, hourly_rate, status, skill) VALUES
  ((SELECT id FROM users WHERE email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.sam@test.com'), 60.00, 'ACTIVE', 'FRONTEND'),
  ((SELECT id FROM users WHERE email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.sam@test.com'), 70.00, 'ACTIVE', 'BACKEND'),
  ((SELECT id FROM users WHERE email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.sam@test.com'), 50.00, 'ACTIVE', 'QA'),
  ((SELECT id FROM users WHERE email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.tina@test.com'), 80.00, 'ACTIVE', 'DEVOPS'),
  ((SELECT id FROM users WHERE email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.tina@test.com'), 65.00, 'ACTIVE', 'DATA');

-- ----------------------------------------------------------------------------
-- 5. projects
-- ----------------------------------------------------------------------------
-- Dates are anchored to "today" ~= 2026-08-19 — adjust if you're seeding on a
-- very different date and want "approaching end date" / "past end date,
-- still active" to keep demonstrating correctly.
INSERT INTO projects (name, description, pm_id, start_date, end_date, expected_hours, status) VALUES
  ('Payments API', 'Core payments processing service.',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'),
   '2026-06-01', '2026-08-28', 200.00, 'ACTIVE'),
  ('Mobile App Revamp', 'iOS/Android app redesign.',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'),
   '2026-05-01', '2026-07-25', 100.00, 'COMPLETED'),
  ('Data Pipeline Modernization', 'Replace legacy ETL with streaming pipeline.',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'),
   '2026-07-01', '2026-09-30', 150.00, 'ACTIVE'),
  ('Legacy Portal Overdue', 'Internal portal maintenance — deliberately unstaffed test case.',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'),
   '2026-05-01', '2026-08-01', 60.00, 'ACTIVE');

-- ----------------------------------------------------------------------------
-- 6. project_requirements
-- ----------------------------------------------------------------------------
INSERT INTO project_requirements (project_id, skill, required_count) VALUES
  ((SELECT id FROM projects WHERE name = 'Payments API'), 'FRONTEND', 1),
  ((SELECT id FROM projects WHERE name = 'Payments API'), 'BACKEND', 1),
  ((SELECT id FROM projects WHERE name = 'Mobile App Revamp'), 'QA', 1),
  ((SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), 'DEVOPS', 1),
  ((SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), 'DATA', 1),
  ((SELECT id FROM projects WHERE name = 'Legacy Portal Overdue'), 'BACKEND', 1);

-- ----------------------------------------------------------------------------
-- 7. project_assignments
-- ----------------------------------------------------------------------------
-- NOTE: active_contractor_key is a STORED GENERATED column
-- (IF(status='ACTIVE', contractor_id, NULL)) — it is intentionally NOT in
-- this column list. MySQL/MariaDB compute it automatically; supplying a
-- value for it yourself would be rejected.
INSERT INTO project_assignments
  (contractor_id, project_id, requirement_id, assigned_date, allocated_hours, status, released_at)
VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'),
   (SELECT id FROM project_requirements WHERE project_id = (SELECT id FROM projects WHERE name = 'Payments API') AND skill = 'FRONTEND'),
   '2026-06-02', 100.00, 'ACTIVE', NULL),

  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'),
   (SELECT id FROM project_requirements WHERE project_id = (SELECT id FROM projects WHERE name = 'Payments API') AND skill = 'BACKEND'),
   '2026-06-02', 100.00, 'ACTIVE', NULL),

  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'),
   (SELECT id FROM project_requirements WHERE project_id = (SELECT id FROM projects WHERE name = 'Mobile App Revamp') AND skill = 'QA'),
   '2026-05-02', 100.00, 'RELEASED', '2026-07-25 12:00:00'),

  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'),
   (SELECT id FROM project_requirements WHERE project_id = (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization') AND skill = 'DEVOPS'),
   '2026-07-02', 80.00, 'ACTIVE', NULL),

  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'),
   (SELECT id FROM project_requirements WHERE project_id = (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization') AND skill = 'DATA'),
   '2026-07-02', 70.00, 'ACTIVE', NULL);
-- Legacy Portal Overdue intentionally has NO assignment -> exercises the
-- "Pending Staffing" KPI and empty progress state.

-- ----------------------------------------------------------------------------
-- 8. timesheets  (daily rows; work_date is the actual day worked)
-- ----------------------------------------------------------------------------
-- Contractor 1 (Nina Cole) on Payments API — approved 30h, 1 pending, 1 rejected
INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at, reviewed_by, reviewed_at) VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-03', 8.00, 'APPROVED', '2026-08-03 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-04 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-04', 8.00, 'APPROVED', '2026-08-04 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-05 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-05', 4.00, 'REJECTED', '2026-08-05 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-06 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-10', 8.00, 'APPROVED', '2026-08-10 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-11 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-11', 6.00, 'APPROVED', '2026-08-11 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-12 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c1@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-17', 5.00, 'PENDING', '2026-08-17 18:00:00', NULL, NULL);

-- Contractor 2 (Omar Silva) on Payments API — approved 32h, 1 pending
INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at, reviewed_by, reviewed_at) VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-03', 8.00, 'APPROVED', '2026-08-03 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-04 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-04', 8.00, 'APPROVED', '2026-08-04 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-05 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-10', 8.00, 'APPROVED', '2026-08-10 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-11 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-11', 8.00, 'APPROVED', '2026-08-11 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-08-12 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c2@test.com'),
   (SELECT id FROM projects WHERE name = 'Payments API'), '2026-08-17', 4.00, 'PENDING', '2026-08-17 18:00:00', NULL, NULL);

-- Contractor 3 (Priya Nair) on Mobile App Revamp (COMPLETED project) — approved 40h total
INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at, reviewed_by, reviewed_at) VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'), '2026-07-06', 8.00, 'APPROVED', '2026-07-06 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-07-07 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'), '2026-07-07', 8.00, 'APPROVED', '2026-07-07 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-07-08 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'), '2026-07-13', 8.00, 'APPROVED', '2026-07-13 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-07-14 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'), '2026-07-14', 8.00, 'APPROVED', '2026-07-14 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-07-15 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'), '2026-07-20', 8.00, 'APPROVED', '2026-07-20 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.alice@test.com'), '2026-07-21 09:00:00');

-- Contractor 4 (Derek Kim) on Data Pipeline Modernization — approved 22h, 1 pending
INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at, reviewed_by, reviewed_at) VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-03', 8.00, 'APPROVED', '2026-08-03 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-04 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-04', 8.00, 'APPROVED', '2026-08-04 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-05 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-10', 6.00, 'APPROVED', '2026-08-10 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-11 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-17', 5.00, 'PENDING', '2026-08-17 18:00:00', NULL, NULL);

-- Contractor 5 (Elena Ruiz) on Data Pipeline Modernization — approved 20h, 1 pending
INSERT INTO timesheets (contractor_id, project_id, work_date, hours_logged, status, submitted_at, reviewed_by, reviewed_at) VALUES
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-03', 7.00, 'APPROVED', '2026-08-03 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-04 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-04', 7.00, 'APPROVED', '2026-08-04 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-05 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-10', 6.00, 'APPROVED', '2026-08-10 18:00:00',
   (SELECT id FROM users WHERE email = 'seed.pm.bob@test.com'), '2026-08-11 09:00:00'),
  ((SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), '2026-08-17', 3.00, 'PENDING', '2026-08-17 18:00:00', NULL, NULL);

-- ----------------------------------------------------------------------------
-- 9. milestones  (project-level; threshold_hours compared against total
--    project-wide approved hours by the application)
-- ----------------------------------------------------------------------------
INSERT INTO milestones (project_id, name, threshold_hours, status, met_at) VALUES
  ((SELECT id FROM projects WHERE name = 'Payments API'), 'Phase 1 Delivery', 100.00, 'PENDING', NULL),
  ((SELECT id FROM projects WHERE name = 'Mobile App Revamp'), 'Final Delivery', 40.00, 'MET', '2026-07-21 10:00:00'),
  ((SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'), 'Sprint 1 Checkpoint', 35.00, 'MET', '2026-08-11 10:00:00');
-- Legacy Portal Overdue intentionally has no milestone yet.

-- ----------------------------------------------------------------------------
-- 10. milestone_billings  (immutable per-contractor snapshot for each MET
--     milestone: approved_hours * hourly_rate = billing_amount)
-- ----------------------------------------------------------------------------
INSERT INTO milestone_billings (milestone_id, contractor_id, approved_hours, hourly_rate, billing_amount) VALUES
  ((SELECT id FROM milestones WHERE name = 'Final Delivery'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   40.00, 50.00, 2000.00),
  ((SELECT id FROM milestones WHERE name = 'Sprint 1 Checkpoint'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   22.00, 80.00, 1760.00),
  ((SELECT id FROM milestones WHERE name = 'Sprint 1 Checkpoint'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   20.00, 65.00, 1300.00);

-- ----------------------------------------------------------------------------
-- 11. invoices  (one per milestone_billings row; amount is a direct,
--     unmodified copy of that row's billing_amount)
-- ----------------------------------------------------------------------------
-- C3 -> Vendor Sam: APPROVED (this is the only invoice that counts as
-- "earned" anywhere in the dashboards).
INSERT INTO invoices
  (milestone_billing_id, project_id, contractor_id, vendor_id, amount, status, generated_at, reviewed_by, reviewed_at, rejection_reason)
VALUES
  ((SELECT mb.id FROM milestone_billings mb
      JOIN contractors c ON c.id = mb.contractor_id JOIN users u ON u.id = c.user_id
      WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM projects WHERE name = 'Mobile App Revamp'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c3@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.sam@test.com'),
   2000.00, 'APPROVED', '2026-07-21 10:05:00',
   (SELECT id FROM users WHERE email = 'seed.vendor.sam@test.com'), '2026-07-22 09:00:00', NULL);

-- C4 -> Vendor Tina: still PENDING_REVIEW (not yet earned).
INSERT INTO invoices
  (milestone_billing_id, project_id, contractor_id, vendor_id, amount, status, generated_at, reviewed_by, reviewed_at, rejection_reason)
VALUES
  ((SELECT mb.id FROM milestone_billings mb
      JOIN contractors c ON c.id = mb.contractor_id JOIN users u ON u.id = c.user_id
      WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c4@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.tina@test.com'),
   1760.00, 'PENDING_REVIEW', '2026-08-11 10:05:00', NULL, NULL, NULL);

-- C5 -> Vendor Tina: REJECTED (not earned either).
INSERT INTO invoices
  (milestone_billing_id, project_id, contractor_id, vendor_id, amount, status, generated_at, reviewed_by, reviewed_at, rejection_reason)
VALUES
  ((SELECT mb.id FROM milestone_billings mb
      JOIN contractors c ON c.id = mb.contractor_id JOIN users u ON u.id = c.user_id
      WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM projects WHERE name = 'Data Pipeline Modernization'),
   (SELECT c.id FROM contractors c JOIN users u ON u.id = c.user_id WHERE u.email = 'seed.contractor.c5@test.com'),
   (SELECT id FROM users WHERE email = 'seed.vendor.tina@test.com'),
   1300.00, 'REJECTED', '2026-08-11 10:05:00',
   (SELECT id FROM users WHERE email = 'seed.vendor.tina@test.com'), '2026-08-12 09:00:00',
   'Hours mismatch with submitted timesheet, please resubmit corrected billing.');

COMMIT;

-- ============================================================================
-- Cleanup (commented out): removes ONLY the rows this script inserted.
-- Uncomment and run to reset before re-seeding, or if you want to remove the
-- test data later. Child-to-parent order (reverse of insertion order) so no
-- FK constraint is ever violated.
-- ============================================================================
-- START TRANSACTION;
-- DELETE i FROM invoices i
--   JOIN contractors c ON c.id = i.contractor_id JOIN users u ON u.id = c.user_id
--   WHERE u.email LIKE 'seed.contractor.%@test.com';
-- DELETE mb FROM milestone_billings mb
--   JOIN contractors c ON c.id = mb.contractor_id JOIN users u ON u.id = c.user_id
--   WHERE u.email LIKE 'seed.contractor.%@test.com';
-- DELETE m FROM milestones m
--   JOIN projects p ON p.id = m.project_id JOIN users u ON u.id = p.pm_id
--   WHERE u.email IN ('seed.pm.alice@test.com', 'seed.pm.bob@test.com');
-- DELETE t FROM timesheets t
--   JOIN contractors c ON c.id = t.contractor_id JOIN users u ON u.id = c.user_id
--   WHERE u.email LIKE 'seed.contractor.%@test.com';
-- DELETE pa FROM project_assignments pa
--   JOIN contractors c ON c.id = pa.contractor_id JOIN users u ON u.id = c.user_id
--   WHERE u.email LIKE 'seed.contractor.%@test.com';
-- DELETE pr FROM project_requirements pr
--   JOIN projects p ON p.id = pr.project_id JOIN users u ON u.id = p.pm_id
--   WHERE u.email IN ('seed.pm.alice@test.com', 'seed.pm.bob@test.com');
-- DELETE p FROM projects p
--   JOIN users u ON u.id = p.pm_id
--   WHERE u.email IN ('seed.pm.alice@test.com', 'seed.pm.bob@test.com');
-- DELETE c FROM contractors c
--   JOIN users u ON u.id = c.user_id
--   WHERE u.email LIKE 'seed.contractor.%@test.com';
-- DELETE pm FROM project_managers pm
--   JOIN users u ON u.id = pm.user_id
--   WHERE u.email IN ('seed.pm.alice@test.com', 'seed.pm.bob@test.com');
-- DELETE FROM client_companies WHERE normalized_name IN ('acme technologies', 'globex corp');
-- DELETE FROM users WHERE email LIKE 'seed.%@test.com';
-- COMMIT;
