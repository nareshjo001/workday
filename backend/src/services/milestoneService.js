const { pool } = require("../config/db");
const milestoneRepository = require("../repositories/milestoneRepository");
const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const billingService = require("./billingService");
const invoiceService = require("./invoiceService");

/**
 * Module 5 integration boundary.
 *
 * This is the ONLY place Module 4 talks to milestone/billing concerns —
 * timesheetService (Module 4) knows the single fact "a timesheet was
 * just approved, go ask the milestone module to evaluate this project",
 * and nothing more. No milestone/billing business logic (summing
 * approved hours, checking HOURS_THRESHOLD rows, marking a milestone
 * MET, generating an invoice) lives in Module 4 — that is entirely
 * Module 5's responsibility, implemented behind this same function
 * signature so Module 4 never has to change when Module 5 lands.
 *
 * checkMilestonesAfterTimesheetApproval(...) below is that exact same
 * function pmTimesheetService.reviewTimesheet already calls, kept with
 * its original name/signature per the Module 5 spec's explicit
 * instruction to adapt the existing hook rather than create a second,
 * unrelated one. It is now a thin wrapper around
 * evaluateMilestonesForContractorProject — the ONE source of truth for
 * milestone detection, also used by pmMilestoneService when a brand new
 * milestone is created against a contractor who has already cleared its
 * threshold (see that function's own comment for why).
 */

/**
 * The real milestone-detection + billing entry point, called both:
 *   1. After every timesheet approval (via checkMilestonesAfterTimesheetApproval).
 *   2. Immediately after a PM creates a new milestone (via pmMilestoneService),
 *      so a milestone created retroactively below the contractor's
 *      already-approved hours is caught and billed right away instead of
 *      silently waiting for the contractor's NEXT approved timesheet.
 *
 * One transaction, covering steps 1-4 below; step 5 (the Module 6 hook)
 * runs AFTER commit, once per milestone newly marked MET, each wrapped
 * in its own try/catch so a failure there can never affect anything
 * already committed:
 *   1. Lock every PENDING milestone for this contractor+project
 *      (`SELECT ... FOR UPDATE`) — this is the actual concurrency
 *      guarantee: a second, concurrent evaluation for the SAME
 *      contractor+project (e.g. two timesheet approvals landing at
 *      nearly the same time) blocks here until this transaction commits
 *      or rolls back, so it can never double-process the same milestone.
 *   2. Verify the contractor is still assigned to this project
 *      (project_assignments) — a defensive re-check, not just trusting
 *      the caller, per the Module 5 spec's edge case on contractor-
 *      project-assignment verification inside the milestone check.
 *   3. Sum the contractor's APPROVED hours for this project, freshly,
 *      inside this same transaction (never trusted from any caller).
 *   4. For every locked milestone whose threshold is now met, mark it
 *      MET and record its immutable billing snapshot — hourly_rate is
 *      read from contractors.hourly_rate INSIDE this transaction (row-
 *      locked via findByIdForUpdate), never from any request payload.
 *   5. COMMIT. Then, outside the transaction, invoke the Module 6 stub
 *      hook once per newly-MET milestone.
 *
 * This function deliberately never throws — a failure here must never
 * surface as a failure of whatever triggered it (a successful timesheet
 * approval, or a successful milestone creation). Errors are logged and
 * swallowed; see the try/catch below.
 */
async function evaluateMilestonesForContractorProject(projectId, contractorId) {
  const conn = await pool.getConnection();
  let newlyMet = [];
  try {
    await conn.beginTransaction();

    const pending = await milestoneRepository.lockPendingForContractorProject(
      conn,
      projectId,
      contractorId
    );
    if (pending.length === 0) {
      await conn.commit();
      return;
    }

    const isAssigned = await assignmentRepository.existsFor(contractorId, projectId);
    if (!isAssigned) {
      // Defensive only — should be unreachable in the MVP (there is no
      // "unassign" action anywhere in this codebase), but a milestone
      // must never bill hours for a contractor who isn't actually on
      // this project. Nothing to evaluate; commit the no-op read and
      // stop.
      await conn.commit();
      return;
    }

    const contractor = await contractorRepository.findByIdForUpdate(conn, contractorId);
    if (!contractor) {
      // Should be unreachable — a milestone/timesheet always references
      // a real contractor row — but guard rather than crash mid-transaction.
      await conn.commit();
      return;
    }

    const approvedHours = await milestoneRepository.sumApprovedHours(conn, contractorId, projectId);

    for (const milestone of pending) {
      if (approvedHours < Number(milestone.threshold_hours)) continue;

      const marked = await milestoneRepository.markMet(conn, milestone.id);
      if (!marked) continue; // Lost an (unreachable, under this row lock) race — skip, not an error.

      const billing = await billingService.createBillingRecord(conn, {
        milestoneId: milestone.id,
        contractorId,
        approvedHours,
        hourlyRate: contractor.hourly_rate,
      });
      // billing is null only if a billing row already existed
      // (ER_DUP_ENTRY) — unreachable under the row lock held for this
      // transaction, but createBillingRecord treats it as "already
      // billed" rather than an error either way.
      if (billing) {
        newlyMet.push({ milestoneId: milestone.id, ...billing });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    // Never propagate — see this function's own doc comment above for
    // why. The timesheet approval (or milestone creation) that triggered
    // this already succeeded and must not appear to have failed.
    console.error(
      `[milestoneService] evaluateMilestonesForContractorProject failed for project ${projectId}, contractor ${contractorId}:`,
      err
    );
    return;
  } finally {
    conn.release();
  }

  // Module 6 boundary — called only after the milestone's MET transition
  // and billing snapshot are both safely committed. A failure here must
  // never undo either. `milestoneBillingId` (the milestone_billings
  // row's own id, threaded back out of billingService.createBillingRecord
  // above) is what invoiceService actually anchors the invoice to — see
  // that function's own comment for why it re-derives project/contractor
  // from that id rather than trusting projectId/contractorId/billingAmount
  // here, which are passed only for logging/back-compat with this call
  // site's original Module 5 signature.
  for (const met of newlyMet) {
    try {
      await invoiceService.generateInvoiceForMilestone({
        milestoneBillingId: met.billingId,
        milestoneId: met.milestoneId,
        projectId,
        contractorId,
        billingAmount: met.billingAmount,
      });
    } catch (err) {
      console.error(
        `[milestoneService] invoiceService.generateInvoiceForMilestone failed for milestone ${met.milestoneId}:`,
        err
      );
    }
  }
}

/**
 * Called exactly once, immediately after a timesheet's approval
 * transaction has committed (never on rejection, and never from inside
 * the DB transaction itself — see pmTimesheetService.reviewTimesheet).
 * Kept with its original Module 4 name/signature; `timesheetId` and
 * `approvedHours` are accepted for that contract but are NOT trusted as
 * the authoritative total — evaluateMilestonesForContractorProject always
 * recomputes the contractor's true approved-hours sum fresh from
 * `timesheets` inside its own transaction, so this hook stays correct
 * even if called out of order or (defensively) more than once for the
 * same approval.
 *
 * @param {object} params
 * @param {number} params.projectId - The project the approved timesheet was logged against.
 * @param {number} params.contractorId - The contractor whose hours were approved.
 * @param {number} params.timesheetId - The specific timesheet that was approved.
 * @param {number} params.approvedHours - hours_logged on the approved timesheet.
 * @returns {Promise<void>}
 */
async function checkMilestonesAfterTimesheetApproval({
  projectId,
  contractorId,
  timesheetId,
  approvedHours,
}) {
  return evaluateMilestonesForContractorProject(projectId, contractorId);
}

module.exports = {
  checkMilestonesAfterTimesheetApproval,
  evaluateMilestonesForContractorProject,
};
