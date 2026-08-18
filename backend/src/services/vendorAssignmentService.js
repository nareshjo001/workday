const { pool } = require("../config/db");
const contractorRepository = require("../repositories/contractorRepository");
const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const ApiError = require("../utils/ApiError");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically assigns one or more contractors to a single project staffing
 * requirement, on behalf of `vendorId` — the authenticated vendor's
 * users.id, resolved by the controller from the JWT.
 * POST /api/vendor/projects/:projectId/requirements/:requirementId/assign,
 * body `{ contractorIds: [...] }`.
 *
 * MVP FIX 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): the Vendor's ONLY responsibility here is picking which
 * contractors fill the requirement's headcount slots. This function never
 * accepts, reads, or trusts an hours value from the request — there is no
 * `allocatedHours` field anywhere in this function's input, and every new
 * assignment is inserted with allocated_hours = NULL (see
 * assignmentRepository.createWithRequirement). Allocating actual hours to
 * an assigned contractor is exclusively pmProjectService.updateContractorAllocation's
 * job, reachable only from a PM-authenticated route — even a Vendor
 * request that manually stuffs an `allocatedHours`/`allocated_hours`
 * field into the body is silently ignored, because the validator
 * (vendorAssignmentValidators.validateAssignContractors) never looks for
 * that field at all, and this service never looks for it either.
 *
 * Every condition below is enforced INSIDE the transaction, after the
 * PROJECT row has been locked (and, nested inside that, the requirement
 * row), not as a fire-and-forget pre-check — this is what makes the
 * whole batch atomic: any single contractor failing any check (not
 * owned, not ACTIVE, wrong skill, already actively assigned elsewhere, or
 * exceeding remaining headcount capacity) rolls back the ENTIRE batch,
 * per spec section 8 ("no partial assignment").
 *
 * Lock ordering is always project -> requirement (never the reverse) so
 * two concurrent requests against different requirements on the SAME
 * project can never deadlock against each other.
 *
 *   1. project exists, is ACTIVE, and its end date hasn't passed
 *   2. PROJECT ROW LOCKED (`SELECT ... FOR UPDATE`) — kept even though
 *      this function no longer validates hours capacity itself, because
 *      it still needs to serialize against a PM's concurrent allocation
 *      update on the SAME project (pmProjectService.updateContractorAllocation
 *      also locks the project row first, same ordering) — see that
 *      function's own doc comment.
 *   3. the requirement belongs to this project (lockRequirementForUpdateById
 *      double-checks project_id, not just requirement id)
 *   4. contractorIds has no duplicates and isn't larger than the
 *      requirement's remaining open HEADCOUNT slots — reject the whole
 *      batch up front rather than partially filling it (unchanged Module
 *      3 rule)
 *   5. EACH contractor: belongs to this vendor, is ACTIVE, skill matches
 *      the requirement, and is not already on an ACTIVE assignment
 *      anywhere (a RELEASED contractor IS eligible again — see migration
 *      016's active_contractor_key generated column)
 */
async function assignContractors(vendorId, projectId, requirementId, contractorIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Locks the project row for the rest of this transaction — the real
    // guarantee behind the hours-capacity check below.
    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project) {
      throw ApiError.notFound("Project not found.");
    }
    if (project.status !== "ACTIVE") {
      throw ApiError.conflict("This project is not open for staffing.");
    }
    if (project.end_date && project.end_date < todayDateString()) {
      throw ApiError.conflict("This project's end date has passed and it is no longer open for staffing.");
    }

    // Locks the requirement row for the rest of this transaction. A
    // second, concurrent transaction trying to lock the SAME row blocks
    // here until this one commits or rolls back — that wait is what makes
    // the headcount capacity check below safe under concurrency, not the
    // check itself.
    const requirement = await assignmentRepository.lockRequirementForUpdateById(
      conn,
      projectId,
      requirementId
    );
    if (!requirement) {
      throw ApiError.notFound("Requirement not found on this project.");
    }

    const assignedCount = await assignmentRepository.countAssignmentsForRequirement(
      conn,
      requirement.id
    );
    const remainingSlots = requirement.required_count - assignedCount;

    if (remainingSlots <= 0) {
      throw ApiError.conflict(`The "${requirement.skill}" requirement on this project is already fully staffed.`);
    }
    if (contractorIds.length > remainingSlots) {
      throw ApiError.badRequest(
        `Only ${remainingSlots} open slot(s) remain for "${requirement.skill}" — cannot assign ${contractorIds.length} contractor(s) at once.`
      );
    }

    // Validate EVERY contractor before inserting ANY — a single invalid
    // contractor in the batch must reject the whole request, not silently
    // assign the valid ones and skip the rest.
    for (const contractorId of contractorIds) {
      const contractor = await contractorRepository.findByVendorAndIdForUpdate(
        conn,
        vendorId,
        contractorId
      );
      if (!contractor) {
        throw ApiError.notFound(`Contractor ${contractorId} not found.`);
      }
      if (contractor.status !== "ACTIVE") {
        throw ApiError.badRequest(`Contractor ${contractorId} is not ACTIVE and cannot be assigned.`);
      }
      if (!contractor.skill || contractor.skill !== requirement.skill) {
        throw ApiError.badRequest(
          `Contractor ${contractorId} does not have the "${requirement.skill}" skill required here.`
        );
      }
      const assignedElsewhere = await assignmentRepository.isContractorAssigned(conn, contractorId);
      if (assignedElsewhere) {
        throw ApiError.conflict(
          `Contractor ${contractorId} is already on an active assignment and cannot be assigned to another until released.`
        );
      }
    }

    try {
      for (const contractorId of contractorIds) {
        // allocatedHours is always null here — MVP fix 1, see this
        // function's own doc comment. The PM sets a real value afterward
        // via pmProjectService.updateContractorAllocation.
        await assignmentRepository.createWithRequirement(conn, contractorId, projectId, requirement.id, null);
      }
    } catch (err) {
      // Race-safety net: two near-simultaneous requests could still
      // collide on the UNIQUE(contractor_id, project_id) or the new
      // UNIQUE(active_contractor_key) constraint despite the pre-checks
      // above (e.g. the same contractor assigned via a different
      // requirement's in-flight transaction that committed between this
      // one's pre-check and its insert). Turn that into a clean 409
      // rather than a raw DB error — either way the whole batch still
      // rolls back.
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict(
          "One or more selected contractors were assigned to a project by another request just now. Please refresh and try again."
        );
      }
      throw err;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Re-fetch fresh, post-commit state for the response — every card/
  // requirement the client renders should reflect the true server-side
  // count, not a locally-reconstructed one.
  const [requirementRows, allocatedHours] = await Promise.all([
    projectRepository.listRequirementsWithCounts([projectId]),
    assignmentRepository.sumAllocatedHoursForProject(pool, projectId),
  ]);
  const updatedRequirement = requirementRows.find((r) => r.id === requirementId);

  return {
    project_id: projectId,
    requirement: updatedRequirement
      ? {
          id: updatedRequirement.id,
          skill: updatedRequirement.skill,
          required_count: updatedRequirement.required_count,
          assigned_count: updatedRequirement.assigned_count,
        }
      : null,
    assigned_contractor_ids: contractorIds,
    // Still informational only — reflects whatever the PM has allocated
    // so far via updateContractorAllocation, unaffected by this Vendor
    // action (which never touches allocated_hours).
    project_allocated_hours: allocatedHours,
  };
}

module.exports = { assignContractors };
