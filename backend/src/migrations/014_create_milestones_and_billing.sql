-- Module 5: Milestone & Billing Engine
-- Run this against the target MySQL database (see backend/README.md).
--
-- Two new tables. Both are brand new, so plain CREATE TABLE IF NOT EXISTS
-- is sufficient and safe to re-run — no ALTER-table MySQL/MariaDB
-- portability guard is needed here (see migration 012's identical
-- reasoning; that guard is only required for ADD COLUMN/INDEX/CONSTRAINT
-- IF NOT EXISTS, a MariaDB-only extension).
--
-- ============================================================
-- milestones
-- ============================================================
-- A milestone is PROJECT + CONTRACTOR specific, never a project-wide
-- total across every contractor staffed on it — two different
-- contractors on the same project each accumulate and are billed against
-- their OWN approved hours, never each other's (Module 5 spec: "milestones
-- are project+contractor-specific, not summed across contractors"). This
-- is why contractor_id lives directly on this table rather than being
-- implied some other way.
--
-- contractor_id -> contractors.id, NOT project_assignments.id — a
-- milestone outlives any single assignment row conceptually (mirrors how
-- timesheets.contractor_id already points straight at contractors.id, see
-- migration 012), and the actual "is this contractor really on this
-- project" check is enforced in the application layer (pmMilestoneService
-- at creation time, milestoneService.evaluateMilestonesForContractorProject
-- at evaluation time) against project_assignments — not by an FK here,
-- the same division of responsibility timesheets already uses.
--
-- threshold_hours is the only milestone "type" this MVP supports (an
-- HOURS_THRESHOLD milestone — approved hours reaching this value is what
-- triggers MET). There is deliberately no `type` column: adding one for a
-- single always-the-same value would be speculative generality with
-- nothing else in the schema to vary it yet. A future milestone type can
-- add that column when it actually exists.
--
-- status starts PENDING and transitions to MET exactly once, via the
-- conditional `UPDATE ... WHERE status = 'PENDING'` pattern already
-- proven by timesheets.markReviewed (migration 012/pmTimesheetService) —
-- see milestoneRepository.markMet. There is no path back from MET to
-- PENDING in this MVP (approved hours are never un-approved).
--
-- idx_milestones_project_contractor_status supports the exact query
-- milestoneService needs on every timesheet approval: "every PENDING
-- milestone for this project+contractor", row-locked with FOR UPDATE —
-- see milestoneRepository.lockPendingMilestonesForProjectContractor. This
-- is also the index that makes concurrent-approval serialization cheap:
-- two simultaneous approvals for the same contractor+project lock
-- against the same small index range, not a full table scan.
CREATE TABLE IF NOT EXISTS milestones (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  project_id       INT NOT NULL,
  contractor_id    INT NOT NULL,
  name             VARCHAR(150) NOT NULL,
  threshold_hours  DECIMAL(7,2) NOT NULL,
  status           ENUM('PENDING', 'MET') NOT NULL DEFAULT 'PENDING',
  met_at           TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_milestones_project_contractor_status (project_id, contractor_id, status),

  CONSTRAINT fk_milestones_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_milestones_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- milestone_billings
-- ============================================================
-- An IMMUTABLE snapshot of what a milestone billed for, taken at the
-- exact moment it was marked MET. approved_hours and hourly_rate are
-- copied here (not left to be re-derived later) precisely so that a
-- future change to contractors.hourly_rate can never silently alter what
-- an already-billed milestone is worth — billing_amount is computed once,
-- from these two snapshot values, and stored, never recalculated from
-- live data afterward. See billingService.calculateBillingAmount.
--
-- contractor_id is intentionally redundant with milestones.contractor_id
-- (every milestone already has exactly one contractor) — it is repeated
-- here, rather than requiring a join back to milestones, specifically so
-- UNIQUE(milestone_id, contractor_id) below can be the literal
-- application-independent, DB-enforced duplicate-billing guarantee the
-- Module 5 spec calls for, the same "app logic AND a DB constraint"
-- belt-and-suspenders pattern this project uses everywhere else a race
-- matters (see UNIQUE(contractor_id, project_id, work_date) on timesheets,
-- migration 013; UNIQUE(contractor_id) on project_assignments, migration
-- 011). In practice a milestone can only ever be billed for its own
-- contractor, so this constraint is equivalent to a plain
-- UNIQUE(milestone_id) — it is written as a composite to match the
-- Module 5 spec's exact wording and to make the "which contractor was
-- this bill for" fact visible on the row itself without a join.
--
-- No FK constraint ties billing_amount's arithmetic to anything — it is
-- application-computed (approved_hours * hourly_rate, rounded to 2
-- decimal places) and stored as a plain value, not a generated column,
-- so the exact number that was billed is preserved byte-for-byte even if
-- a future migration changed how the calculation works.
CREATE TABLE IF NOT EXISTS milestone_billings (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  milestone_id     INT NOT NULL,
  contractor_id    INT NOT NULL,
  approved_hours   DECIMAL(7,2) NOT NULL,
  hourly_rate      DECIMAL(10,2) NOT NULL,
  billing_amount   DECIMAL(12,2) NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_milestone_billings_milestone_contractor (milestone_id, contractor_id),
  INDEX idx_milestone_billings_contractor (contractor_id),

  CONSTRAINT fk_milestone_billings_milestone FOREIGN KEY (milestone_id) REFERENCES milestones(id),
  CONSTRAINT fk_milestone_billings_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
