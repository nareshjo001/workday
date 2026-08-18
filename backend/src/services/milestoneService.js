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
 * For MVP this is a deliberate no-op placeholder: it exists so the call
 * site (pmTimesheetService.reviewTimesheet, right after the approval
 * transaction commits) is wired up, real, and easy to find — not so it
 * does anything yet. Do NOT add billing/invoice logic here; add it in a
 * real Module 5 milestone module and have this function delegate to it.
 */

/**
 * Called exactly once, immediately after a timesheet's approval
 * transaction has committed (never on rejection, and never from inside
 * the DB transaction itself — see pmTimesheetService). Module 5 will use
 * this to:
 *   1. Sum approved hours for this contractor/project.
 *   2. Find HOURS_THRESHOLD milestones for the project.
 *   3. Determine whether a threshold has now been reached.
 *   4. Mark the relevant milestone MET.
 *   5. (Later) trigger billing/invoice generation.
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
  // Intentionally a no-op for the Module 4 MVP. Module 5 replaces this
  // body with real milestone evaluation; the call site never needs to
  // change.
  return null;
}

module.exports = { checkMilestonesAfterTimesheetApproval };
