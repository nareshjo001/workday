const { pool } = require("../config/db");
const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const projectRepository = require("../repositories/projectRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const ApiError = require("../utils/ApiError");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * THE security boundary for "which dates can a contractor log hours
 * against" — deliberately server-side only, never trusting a browser's
 * <input type="date"> min/max attributes (those are a UX convenience the
 * frontend also sets, but a request built by hand or replayed with a
 * different date must be rejected here regardless). Called from both
 * submitTimesheet (new daily log) and updateTimesheet (editing a
 * REJECTED log) so the rule is enforced identically, from exactly one
 * place, in both cases:
 *
 *   1. workDate must not be in the future (compared as plain ISO date
 *      strings against `todayDateString()` — no Date object math needed,
 *      same lexicographic-comparison approach pmProjectValidators uses
 *      for start/end date ordering).
 *   2. workDate must not be before the project's start_date.
 *   3. workDate must not be after the project's end_date, if the project
 *      has one set (end_date is nullable — an open-ended project has no
 *      upper bound beyond "not in the future").
 */
function assertWorkDateWithinProject(workDate, project) {
  const today = todayDateString();
  if (workDate > today) {
    throw ApiError.badRequest("workDate cannot be in the future.");
  }
  if (workDate < project.start_date) {
    throw ApiError.badRequest("workDate cannot be before the project's start date.");
  }
  if (project.end_date && workDate > project.end_date) {
    throw ApiError.badRequest("workDate cannot be after the project's end date.");
  }
}

/**
 * Submits a new PENDING daily timesheet row on behalf of the
 * authenticated contractor. `userId` is req.user.userId off the JWT —
 * this resolves it to the contractor's own contractors.id
 * (timesheets.contractor_id is keyed on that, not on users.id, same
 * bridge as contractorProjectService.listAssignedProjects) before doing
 * anything else. There is no parameter here that lets a caller submit
 * hours as a different contractor — contractorId never comes from the
 * request body.
 *
 * Every rule below is enforced here, in order, each with its own clean
 * error — never a raw DB error, and never by trusting anything the
 * client claims about the project's state or the date's validity:
 *   1. The account must resolve to an ACTIVE contractor record
 *      (inactive contractors cannot submit new timesheets).
 *   2. The contractor must actually be assigned to projectId
 *      (project_assignments). Checked via assignmentRepository.existsFor,
 *      the same table/relationship Module 3's "one contractor, one
 *      project, ever" rule already relies on. A non-match returns a
 *      generic 404 rather than confirming/denying the project exists
 *      (no information leakage).
 *   3. The project must be ACTIVE — COMPLETED/ON_HOLD projects reject
 *      new timesheets.
 *   4. workDate must fall inside the project's own date window and not
 *      be in the future — see assertWorkDateWithinProject above.
 *   5. Duplicate contractor/project/day submissions are rejected with a
 *      clean 409 — see the ER_DUP_ENTRY catch below, backed by the
 *      UNIQUE(contractor_id, project_id, work_date) constraint from
 *      migration 013 (the actual guarantee under concurrency, not just
 *      this check).
 */
async function submitTimesheet(userId, { projectId, workDate, hoursLogged }) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot submit timesheets.");
  }

  const isAssigned = await assignmentRepository.existsFor(contractor.id, projectId);
  if (!isAssigned) {
    throw ApiError.notFound("You are not assigned to this project.");
  }

  const project = await projectRepository.findById(projectId);
  if (!project || project.status !== "ACTIVE") {
    throw ApiError.conflict("Timesheets can only be logged against active projects.");
  }

  assertWorkDateWithinProject(workDate, project);

  let timesheetId;
  try {
    timesheetId = await timesheetRepository.create({
      contractorId: contractor.id,
      projectId,
      workDate,
      hoursLogged,
    });
  } catch (err) {
    // Race-safety net: the pre-check above is a friendly read, the
    // UNIQUE(contractor_id, project_id, work_date) constraint (migration
    // 013) is the real guarantee against two near-simultaneous
    // submissions for the same project+day.
    if (err?.code === "ER_DUP_ENTRY") {
      throw ApiError.conflict("A timesheet for this project and date has already been submitted.");
    }
    throw err;
  }

  return timesheetRepository.findById(timesheetId);
}

/**
 * Lists the authenticated contractor's own daily timesheet history,
 * newest day first — a flat list of daily rows. `userId` is
 * req.user.userId off the JWT — there is no parameter here that lets a
 * caller ask for a different contractor's timesheets. Grouping this into
 * the project -> week -> day view is entirely a frontend concern (see
 * frontend/src/components/timesheets/weekGrouping.js) — nothing here
 * computes or returns a weekly total.
 */
async function listMyTimesheets(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return [];
  }
  return timesheetRepository.listByContractor(contractor.id);
}

/**
 * Edits one of the authenticated contractor's own timesheet rows —
 * PATCH /api/contractor/timesheets/:id. This is the ONLY way an existing
 * row's hours/date can change after submission, and it is intentionally
 * narrow:
 *   - Only the row's OWNER may edit it. `userId` resolves to the caller's
 *     own contractors.id exactly like submitTimesheet; the lock read
 *     below compares that id against the row's contractor_id and returns
 *     a generic 404 on any mismatch — the same "don't confirm the row
 *     exists at all" leakage protection pmTimesheetService.reviewTimesheet
 *     uses for cross-PM access.
 *   - Only a REJECTED row may be edited. PENDING (already awaiting
 *     review) and APPROVED (a final, billable decision) are immutable —
 *     attempting to edit either returns a clean 409, enforced both by the
 *     status check below AND by updateRejectedLog's conditional
 *     `WHERE status = 'REJECTED'`, the same belt-and-suspenders pattern
 *     markReviewed uses for the PM review transaction.
 *   - project_id, contractor_id, status, reviewed_by and reviewed_at are
 *     never accepted from the client — only workDate and hoursLogged can
 *     change (see validateEditTimesheet). The project itself is
 *     re-fetched here and re-validated exactly like a fresh submission
 *     (must still be ACTIVE, workDate must still fall inside its window
 *     and not be in the future) — a rejected log from months ago being
 *     edited today must satisfy today's rules, not the rules at the time
 *     it was first submitted.
 *   - A successful edit resets status back to PENDING and clears
 *     reviewed_by/reviewed_at — it re-enters the PM's queue as a new
 *     decision to be made, never silently staying REJECTED or jumping
 *     straight to APPROVED.
 *
 * Runs inside a transaction with a row lock (same FOR UPDATE + conditional
 * UPDATE pattern as pmTimesheetService.reviewTimesheet) so a concurrent
 * edit of the same row can't interleave with this one.
 */
async function updateTimesheet(userId, timesheetId, { workDate, hoursLogged }) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot edit timesheets.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await timesheetRepository.lockForOwnerEdit(conn, timesheetId);
    if (!existing || existing.contractor_id !== contractor.id) {
      // Same 404 whether the row doesn't exist at all or belongs to
      // another contractor — never confirm which.
      throw ApiError.notFound("Timesheet not found.");
    }
    if (existing.status !== "REJECTED") {
      throw ApiError.conflict("Only rejected timesheets can be edited.");
    }

    const project = await projectRepository.findById(existing.project_id);
    if (!project || project.status !== "ACTIVE") {
      throw ApiError.conflict("Timesheets can only be edited for active projects.");
    }
    assertWorkDateWithinProject(workDate, project);

    let updated;
    try {
      updated = await timesheetRepository.updateRejectedLog(conn, timesheetId, { workDate, hoursLogged });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A timesheet for this project and date already exists.");
      }
      throw err;
    }
    if (!updated) {
      // Lost a race — status changed between the lock read and the
      // conditional UPDATE (should be unreachable given the row lock,
      // but the conditional WHERE status = 'REJECTED' is the real
      // guarantee, not the lock alone).
      throw ApiError.conflict("Only rejected timesheets can be edited.");
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Re-fetch fresh, post-commit state for the response, same convention
  // as pmTimesheetService.reviewTimesheet.
  return timesheetRepository.findById(timesheetId);
}

module.exports = { submitTimesheet, listMyTimesheets, updateTimesheet };
