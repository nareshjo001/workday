-- Module 6: Invoice Generation & Approval
-- Run this against the target MySQL database (see backend/README.md).
--
-- One row is generated automatically the moment a Module 5 milestone
-- becomes MET and its milestone_billings snapshot is written (see
-- invoiceService.generateInvoiceForMilestone, called from
-- milestoneService.evaluateMilestonesForContractorProject AFTER that
-- transaction commits). A PM never creates an invoice directly — the
-- only PM-facing mutation is PATCH /api/pm/invoices/:id, which can only
-- move a PENDING_REVIEW row to APPROVED or REJECTED (see
-- invoiceApprovalService.reviewInvoice).
--
-- milestone_billing_id -> milestone_billings.id, NOT milestone_id.
-- milestone_billings (migration 014) is already the immutable snapshot
-- of "how many hours, at what rate, for how much" a MET milestone was
-- worth — an invoice's amount is a direct, unmodified copy of that row's
-- billing_amount (see invoiceService.generateInvoiceForMilestone), never
-- a re-derivation from milestones/timesheets/contractors. Anchoring to
-- the billing row rather than the milestone row makes that dependency
-- explicit in the schema itself.
--
-- UNIQUE(milestone_billing_id) is the actual "exactly one invoice per
-- milestone billing" guarantee under concurrency — the same
-- "app-level idempotency check backed by a real constraint" pattern this
-- project already uses everywhere a duplicate-under-race matters (see
-- UNIQUE(milestone_id, contractor_id) on milestone_billings, migration
-- 014; UNIQUE(contractor_id, project_id, work_date) on timesheets,
-- migration 013). generateInvoiceForMilestone does a friendly SELECT
-- pre-check first (so a normal duplicate call is cheap and returns the
-- existing row without ever touching this constraint), but two truly
-- concurrent calls for the SAME milestone_billing_id both racing past
-- that pre-check is exactly what this constraint prevents — the loser's
-- INSERT fails with ER_DUP_ENTRY and the caller re-fetches the winner's
-- row instead of erroring.
--
-- contractor_id -> contractors.id and vendor_id -> users.id (NOT a
-- separate "vendors" table — there isn't one; a Vendor's identity is
-- their own users.id, the exact same convention projects.pm_id and
-- contractors.vendor_id already use, see migrations 002/003). Both are
-- resolved server-side from the contractor row at generation time
-- (contractor.vendor_id) and snapshotted onto the invoice — never taken
-- from a request. This is deliberate, not just convenient: if a
-- contractor's vendor relationship could ever change in a later module,
-- this invoice's historical ownership must stay exactly what it was
-- when the invoice was generated (spec section 11), so vendor_id is its
-- own stored column, not something re-derived via a live join every
-- time an invoice is displayed.
--
-- reviewed_by -> users.id, NULL until a PM acts on it (AUTO_APPROVED
-- invoices are never reviewed by a PM at all, so this stays NULL for
-- those permanently — see invoiceService's auto-approval path, which
-- never touches reviewed_by/reviewed_at/rejection_reason).
--
-- amount is a plain, immutable DECIMAL(12,2) — matching
-- milestone_billings.billing_amount's own precision exactly, copied
-- once at generation time and never updated afterward. There is no
-- endpoint anywhere that can write to this column after INSERT.
--
-- New table, so a plain CREATE TABLE IF NOT EXISTS is sufficient and
-- safe to re-run — no ALTER-table MySQL/MariaDB portability guard is
-- needed here (that guard, used in migrations 005/006/008/011, is only
-- required for ADD COLUMN/INDEX/CONSTRAINT IF NOT EXISTS, a
-- MariaDB-only extension; CREATE TABLE IF NOT EXISTS is supported
-- identically by both engines).
CREATE TABLE IF NOT EXISTS invoices (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  milestone_billing_id INT NOT NULL,
  project_id          INT NOT NULL,
  contractor_id       INT NOT NULL,
  vendor_id           INT NOT NULL,
  amount              DECIMAL(12,2) NOT NULL,
  status              ENUM('PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'REJECTED') NOT NULL,
  generated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by         INT NULL,
  reviewed_at         TIMESTAMP NULL,
  rejection_reason    VARCHAR(500) NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_invoices_milestone_billing (milestone_billing_id),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_project (project_id),
  INDEX idx_invoices_vendor (vendor_id),
  INDEX idx_invoices_contractor (contractor_id),

  CONSTRAINT fk_invoices_milestone_billing FOREIGN KEY (milestone_billing_id) REFERENCES milestone_billings(id),
  CONSTRAINT fk_invoices_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_invoices_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  CONSTRAINT fk_invoices_vendor FOREIGN KEY (vendor_id) REFERENCES users(id),
  CONSTRAINT fk_invoices_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
