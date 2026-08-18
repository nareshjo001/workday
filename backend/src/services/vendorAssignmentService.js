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
 * users.id, resolved by the controller from the JWT. Replaces the old
 * single-contractor createAssignment (Module 3 revision) now that the API
 * accepts `{ contractorIds: [...] }` in one request
 * (POST /api/vendor/projects/:projectId/requirements/:requirementId/assign,
 * vendor-centric workflow revision spec sections 8-9).
 *
 * Every condition below is enforced INSIDE the transaction, after the
 * requirement row has been locked, not as a fire-and-forget pre-check —
 * this is what makes the whole batch atomic: any single contractor
 * failing any check (not owned, not ACTIVE, wrong skill, already
 * assigned anywhere, or exceeding remaining capacity) rolls back the
 * ENTIRE batch, per spec section 8 ("no partial assignment").
 *
 *   1. project exists, is ACTIVE, and its end date hasn't passed
 *   2. the requirement belongs to this project (lockRequirementForUpdateById
 *      double-checks project_id, not just requirement id)
 *   3. contractorIds has no duplicates and isn't larger than the
 *      requirement's remaining open slots — reject the whole batch up
 *      front rather than partially filling it
 *   4. EACH contractor: belongs to this vendor, is ACTIVE, skill matches
 *      the requirement, and is not already assigned to ANY project
 *      (new global rule — see migration 011's UNIQUE(contractor_id))
 *
 * Concurrency: `SELECT ... FOR UPDATE` on the requirement row (via
 * lockRequirementForUpdateById) is what actually prevents two concurrent
 * assign calls on the SAME requirement from both reading "N slots open"
 * and both succeeding — a second transaction trying to lock the same row
 * blocks until this one commits or rolls back. The
 * UNIQUE(contractor_id) constraint is the backstop for the "same
 * contractor, two different requirements/projects, truly simultaneous
 * requests" case that a single row lock can't cover by itself; any
 * ER_DUP_ENTRY that slips through the pre-check is still caught below and
 * turned into a clean error, never a raw 500.
 */
async function assignContractors(vendorId, projectId, requirementId, contractorIds) {
  const uniqueIds = new Set(contractorIds);
  if (uniqueIds.size !== contractorIds.length) {
    throw ApiError.badRequest("contractorIds contains duplicate values.");
  }

  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  if (project.status !== "ACTIVE") {
    throw ApiError.conflict("This project is not open for staffing.");
  }
  if (project.end_date && project.end_date < todayDateString()) {
    throw ApiError.conflict("This project's end date has passed and it is no longer open for staffing.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Locks the requirement row for the rest of this transaction. A
    // second, concurrent transaction trying to lock the SAME row blocks
    // here until this one commits or rolls back — that wait is what makes
    // the capacity check below safe under concurrency, not the check
    // itself.
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
    const remaining = requirement.required_count - assignedCount;

    if (remaining <= 0) {
      throw ApiError.conflict(`The "${requirement.skill}" requirement on this project is already fully staffed.`);
    }
    if (contractorIds.length > remaining) {
      throw ApiError.badRequest(
        `Only ${remaining} open slot(s) remain for "${requirement.skill}" — cannot assign ${contractorIds.length} contractor(s) at once.`
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
          `Contractor ${contractorId} is already assigned to a project and cannot be assigned to another.`
        );
      }
    }

    try {
      for (const contractorId of contractorIds) {
        await assignmentRepository.createWithRequirement(conn, contractorId, projectId, requirement.id);
      }
    } catch (err) {
      // Race-safety net: two near-simultaneous requests could still
      // collide on the UNIQUE(contractor_id, project_id) or the new
      // UNIQUE(contractor_id) constraint despite the pre-checks above
      // (e.g. the same contractor assigned via a different requirement's
      // in-flight transaction that committed between this one's
      // pre-check and its insert). Turn that into a clean 409 rather than
      // a raw DB error — either way the whole batch still rolls back.
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
  const [requirementRows] = await Promise.all([projectRepository.listRequirementsWithCounts([projectId])]);
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
  };
}

module.exports = { assignContractors };
