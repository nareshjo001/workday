const { pool } = require("../config/db");
const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const ApiError = require("../utils/ApiError");

/**
 * Derives overall SKILL-HEADCOUNT staffing status from a project's
 * requirement rows — this is intentionally NOT stored anywhere (see
 * migration 007's comment): PENDING unless every requirement's
 * assigned_count has met its required_count, in which case
 * FULLY_STAFFED. A project with zero requirements can't happen for new
 * projects (validator requires at least one), but is treated as PENDING
 * defensively rather than crashing on legacy/edge-case data.
 *
 * This is a DIFFERENT, independent concept from the project hours/
 * allocation redesign's `hours_staffing_status` below — headcount
 * staffing answers "do we have enough PEOPLE of each skill"; hours
 * staffing answers "have we allocated enough HOURS of capacity". A
 * project can be FULLY_STAFFED on headcount while still PENDING_STAFFING
 * on hours (e.g. every skill slot filled, but with contractors allocated
 * fewer combined hours than expected_hours) — the two are never merged
 * into one figure.
 */
function deriveStaffingStatus(requirements) {
  if (requirements.length === 0) return "PENDING";
  const fullyStaffed = requirements.every((r) => r.assigned_count >= r.required_count);
  return fullyStaffed ? "FULLY_STAFFED" : "PENDING";
}

/**
 * Derives the project hours/allocation redesign's staffing status:
 * PENDING_STAFFING unless every one of expected_hours is allocated
 * (allocatedHours >= expectedHours), in which case FULLY_STAFFED. Returns
 * null when the project has no expected_hours set (a legacy pre-redesign
 * project) — there's nothing to compare allocated hours against, so
 * "staffed or not" on the hours dimension is simply not a meaningful
 * question for that row, same "don't invent a value that was never
 * captured" stance as pmMilestoneService's expected_hours-null handling.
 */
function deriveHoursStaffingStatus(expectedHours, allocatedHours) {
  if (expectedHours === null) return null;
  return allocatedHours >= expectedHours ? "FULLY_STAFFED" : "PENDING_STAFFING";
}

function toRequirementView(row) {
  return {
    id: row.id,
    skill: row.skill,
    required_count: row.required_count,
    assigned_count: row.assigned_count,
  };
}

/**
 * `hoursMetrics` is an OPTIONAL { allocatedHours, approvedHours } pair —
 * every call site below supplies it (batched for list views, single-shot
 * for the create response), so every project the PM sees carries the
 * SAME server-computed work-progress/staffing-progress figures. Never
 * trusted from the client, never computed twice in two different shapes
 * — this is the one place a project row becomes a project view.
 */
function toProjectView(row, requirements, hoursMetrics) {
  const totalRequired = requirements.reduce((sum, r) => sum + r.required_count, 0);
  const totalAssigned = requirements.reduce((sum, r) => sum + r.assigned_count, 0);

  const expectedHours = row.expected_hours === null || row.expected_hours === undefined ? null : Number(row.expected_hours);
  const allocatedHours = Number(hoursMetrics?.allocatedHours ?? 0);
  const approvedHours = Number(hoursMetrics?.approvedHours ?? 0);
  const remainingAllocationHours = expectedHours === null ? null : Math.max(0, expectedHours - allocatedHours);
  // Work progress is capped for DISPLAY at 100% even if approved hours
  // somehow exceed expected_hours (should not normally happen, since
  // allocation is capped at expected_hours and submission is capped at
  // allocation — but this is a defensive display cap, not a silent data
  // correction: the raw approvedHours figure below is never itself
  // clamped, only the derived percentage is).
  const workProgressPercent =
    expectedHours === null || expectedHours === 0 ? null : Math.min(100, Math.round((approvedHours / expectedHours) * 1000) / 10);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    company_name: row.company_name,
    pm_name: row.pm_name,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    requirements: requirements.map(toRequirementView),
    total_required: totalRequired,
    total_assigned: totalAssigned,
    staffing_status: deriveStaffingStatus(requirements),
    // Project hours/allocation redesign fields — all server-computed,
    // never accepted from a request:
    expected_hours: expectedHours,
    allocated_hours: allocatedHours,
    remaining_allocation_hours: remainingAllocationHours,
    hours_staffing_status: deriveHoursStaffingStatus(expectedHours, allocatedHours),
    approved_hours: approvedHours,
    work_progress_percent: workProgressPercent,
  };
}

/**
 * Creates a project AND its staffing requirements in a single transaction
 * — either both succeed or neither does (Module 3 revision spec section
 * 3). `pmId` is the authenticated PM's users.id, resolved by the
 * controller from the JWT and never taken from the request body.
 * `expectedHours` (project hours/allocation redesign) is stored on the
 * project row itself in the same insert — no separate step.
 */
async function createProject(pmId, { name, description, startDate, endDate, expectedHours, requirements }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const projectId = await projectRepository.create(conn, {
      name,
      description,
      pmId,
      startDate,
      endDate,
      expectedHours,
    });

    await projectRepository.createRequirements(conn, projectId, requirements);

    await conn.commit();

    // Re-fetch rather than manually constructing the response: company_name
    // and pm_name are no longer values we were handed in the request (see
    // pmProjectValidators — company_name is derived, not input), they only
    // exist via the PM/company JOIN in projectRepository.findById. The
    // requirement rows are also re-fetched (rather than reusing the
    // pre-insert `requirements` array) so the response includes each
    // requirement's real `id` — the frontend needs it to link straight to
    // the assignment endpoints.
    const [row, requirementRows] = await Promise.all([
      projectRepository.findById(projectId),
      projectRepository.listRequirementsWithCounts([projectId]),
    ]);
    // A brand new project has no assignments/approved hours yet — no need
    // for a real query, hoursMetrics is trivially {0, 0}.
    return toProjectView(row, requirementRows, { allocatedHours: 0, approvedHours: 0 });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Only ever returns projects owned by `pmId` — scoped in the
 * repository's SQL, not filtered afterward. Each project comes back with
 * its staffing requirements + derived progress/status so the PM never
 * has to calculate that themselves (Module 3 revision spec section 19),
 * now including the project hours/allocation redesign's server-computed
 * allocated/approved/progress figures.
 */
async function listProjects(pmId) {
  const projects = await projectRepository.listByPm(pmId);
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const [requirementRows, allocatedRows, approvedRows] = await Promise.all([
    projectRepository.listRequirementsWithCounts(projectIds),
    assignmentRepository.sumAllocatedHoursForProjects(projectIds),
    timesheetRepository.sumApprovedHoursForProjects(projectIds),
  ]);

  const requirementsByProject = new Map();
  for (const row of requirementRows) {
    if (!requirementsByProject.has(row.project_id)) requirementsByProject.set(row.project_id, []);
    requirementsByProject.get(row.project_id).push(row);
  }
  const allocatedByProject = new Map(allocatedRows.map((r) => [r.project_id, r.allocated_hours]));
  const approvedByProject = new Map(approvedRows.map((r) => [r.project_id, r.approved_hours]));

  return projects.map((p) =>
    toProjectView(p, requirementsByProject.get(p.id) || [], {
      allocatedHours: allocatedByProject.get(p.id) || 0,
      approvedHours: approvedByProject.get(p.id) || 0,
    })
  );
}

/**
 * The contractors currently assigned to one of this PM's own projects —
 * added for Module 5's "create milestone" form (now used for display
 * only, since project-level milestones no longer need a contractor
 * picker — kept for the PM's own visibility into who's staffed). Reuses
 * assignmentRepository.listAssignedContractorsWithHours (already built
 * for the Vendor "Project Team" view) rather than adding a second query
 * for the same join. Enforces project ownership itself
 * (`project.pm_id !== pmId` -> 404, no existence leakage) since, unlike
 * the Vendor side, a PM must never see another PM's project roster.
 */
async function listAssignedContractors(pmId, projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project || project.pm_id !== pmId) {
    // Same 404 whether the project doesn't exist at all or belongs to
    // another PM — never confirm which (same pattern as
    // pmTimesheetService.reviewTimesheet).
    throw ApiError.notFound("Project not found.");
  }

  const rows = await assignmentRepository.listAssignedContractorsWithHours(projectId);
  return rows.map((r) => ({
    contractor_id: r.contractor_id,
    name: r.contractor_name,
    skill: r.contractor_skill,
    status: r.contractor_status,
    allocated_hours: r.allocated_hours,
    assignment_status: r.assignment_status,
    approved_hours: r.approved_hours,
    pending_hours: r.pending_hours,
    remaining_hours: r.remaining_hours,
  }));
}

/**
 * Marks one of the calling PM's own projects COMPLETED —
 * PATCH /api/pm/projects/:id/complete. This is a genuinely new endpoint
 * (none existed before this redesign) required by the spec's E2E flow:
 * a PM explicitly marks a project complete (never auto-triggered by
 * hitting expected_hours — see STEP2_STEP3_PLAN.md's documented decision
 * on why work-progress and lifecycle status stay independent concepts in
 * this codebase), and doing so must, in the SAME transaction, release
 * every still-ACTIVE assignment on it (status -> RELEASED,
 * released_at = NOW()) so those contractors become eligible for a new
 * assignment elsewhere — never deleting the assignment row, preserving
 * it for billing/audit/reporting history.
 *
 * Transaction, same lock-then-conditional-update shape as every other
 * mutating flow in this codebase:
 *   1. Lock the project row (projectRepository.lockByIdForUpdate) —
 *      confirms ownership AND serializes a second concurrent completion
 *      attempt for the same project.
 *   2. markCompleted does the conditional `WHERE status != 'COMPLETED'`
 *      UPDATE — the real atomicity backstop; a project already COMPLETED
 *      returns a clean 409 rather than silently re-releasing assignments
 *      a second time.
 *   3. releaseAllActiveForProject, same connection/transaction — project
 *      completion and assignment release always succeed or fail
 *      together.
 *   4. COMMIT.
 *
 * Historical timesheets and milestone/billing records are completely
 * untouched by this — completion only ever changes projects.status and
 * project_assignments.status/released_at, per the spec's explicit
 * "historical timesheets stay untouched" requirement.
 */
async function completeProject(pmId, projectId) {
  const conn = await pool.getConnection();
  let releasedCount;
  try {
    await conn.beginTransaction();

    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) {
      throw ApiError.notFound("Project not found.");
    }
    if (project.status === "COMPLETED") {
      throw ApiError.conflict("This project is already completed.");
    }

    const updated = await projectRepository.markCompleted(conn, projectId);
    if (!updated) {
      // Lost the race to another request between the lock read above and
      // this UPDATE (should be unreachable given the row lock, but the
      // conditional UPDATE is the real guarantee).
      throw ApiError.conflict("This project is already completed.");
    }

    releasedCount = await assignmentRepository.releaseAllActiveForProject(conn, projectId);

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  const [row, requirementRows, allocatedHours, approvedHours] = await Promise.all([
    projectRepository.findById(projectId),
    projectRepository.listRequirementsWithCounts([projectId]),
    assignmentRepository.sumAllocatedHoursForProject(pool, projectId),
    timesheetRepository.sumApprovedHoursForProject(projectId),
  ]);

  return {
    project: toProjectView(row, requirementRows, { allocatedHours, approvedHours }),
    released_assignment_count: releasedCount,
  };
}

/**
 * Sets (or changes) how many of the project's expected_hours a specific,
 * already-assigned contractor is allocated — MVP fix 1 ("work-hour
 * allocation must belong to the PM, not the Vendor"). The Vendor's
 * assignContractors flow never sets this column (always NULL at
 * assignment time, see vendorAssignmentService/assignmentRepository); this
 * is the ONLY place in the codebase allocated_hours is ever written to a
 * non-null value, and it is reachable only from a PM-authenticated route
 * (PATCH /api/pm/projects/:projectId/contractors/:contractorId/allocation).
 *
 * Transaction, same lock-then-validate-then-update shape as every other
 * mutating flow in this codebase:
 *   1. Lock the project row (projectRepository.lockByIdForUpdate) —
 *      confirms PM ownership AND serializes this against both a
 *      concurrent Vendor assignContractors call on the SAME project (that
 *      function also locks the project row first, same ordering — no
 *      deadlock) and a second concurrent allocation update, which is what
 *      makes the project-wide capacity check below race-safe.
 *   2. Lock the contractor's ACTIVE assignment row on this project
 *      (assignmentRepository.lockActiveForContractorProject) — returns
 *      null if the contractor has never been assigned here, or was
 *      assigned but has since been RELEASED; either way this rejects the
 *      request rather than allocating hours to nothing (spec edge case:
 *      "PM attempts to allocate hours to an unassigned contractor").
 *   3. The new value can never be set below hours already APPROVED for
 *      this contractor on this project (spec requirement: "changing
 *      allocation in a way that makes already-approved hours exceed the
 *      new allocation" must be prevented) — read fresh inside this same
 *      transaction via timesheetRepository.sumApprovedHoursForContractorProject.
 *   4. If the project has expected_hours set, the project-wide total
 *      (every OTHER active assignment's allocated_hours, plus this new
 *      value) must not exceed it — race-safe under the project row lock
 *      from step 1. A legacy project with no expected_hours has no
 *      ceiling to check against, same "don't invent a value that was
 *      never captured" stance used everywhere else in this codebase.
 *   5. UPDATE. COMMIT.
 */
async function updateContractorAllocation(pmId, projectId, contractorId, allocatedHours) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) {
      throw ApiError.notFound("Project not found.");
    }

    const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractorId, projectId);
    if (!assignment) {
      throw ApiError.badRequest("Validation failed", [
        "This contractor is not actively assigned to this project.",
      ]);
    }

    const approvedHours = await timesheetRepository.sumApprovedHoursForContractorProject(
      conn,
      contractorId,
      projectId
    );
    if (allocatedHours < approvedHours) {
      throw ApiError.conflict(
        `Cannot set allocated hours (${allocatedHours}) below the ${approvedHours} hour(s) already approved for this contractor on this project.`
      );
    }

    if (project.expected_hours !== null) {
      const expectedHours = Number(project.expected_hours);
      const totalAllocated = await assignmentRepository.sumAllocatedHoursForProject(conn, projectId);
      const currentForThisContractor = assignment.allocated_hours === null ? 0 : Number(assignment.allocated_hours);
      const othersTotal = totalAllocated - currentForThisContractor;
      if (othersTotal + allocatedHours > expectedHours) {
        throw ApiError.conflict(
          `Total allocation would exceed the project's expected hours (${expectedHours}). ` +
            `Remaining unallocated capacity: ${Math.max(0, expectedHours - othersTotal)} hour(s).`
        );
      }
    }

    await assignmentRepository.updateAllocatedHours(conn, assignment.id, allocatedHours);

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Re-fetch fresh, post-commit state for the response, same convention
  // as every other mutating flow in this codebase.
  const rows = await assignmentRepository.listAssignedContractorsWithHours(projectId);
  const updated = rows.find((r) => r.contractor_id === contractorId);
  return {
    contractor_id: contractorId,
    name: updated?.contractor_name ?? null,
    allocated_hours: updated?.allocated_hours ?? allocatedHours,
    assignment_status: updated?.assignment_status ?? null,
    approved_hours: updated?.approved_hours ?? 0,
    pending_hours: updated?.pending_hours ?? 0,
    remaining_hours: updated?.remaining_hours ?? null,
  };
}

module.exports = {
  createProject,
  listProjects,
  listAssignedContractors,
  completeProject,
  updateContractorAllocation,
};
