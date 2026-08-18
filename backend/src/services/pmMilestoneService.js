const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const milestoneRepository = require("../repositories/milestoneRepository");
const milestoneService = require("./milestoneService");
const ApiError = require("../utils/ApiError");

/**
 * Verifies `projectId` exists AND is owned by `pmId`, returning the
 * project row on success. Same 404-either-way pattern used everywhere
 * else a PM/Vendor ownership boundary is checked in this codebase (see
 * pmTimesheetService.reviewTimesheet, pmProjectService.listAssignedContractors)
 * — a PM probing another PM's project id (or a nonexistent one) gets an
 * identical response either way, no information leakage.
 */
async function assertOwnedProject(pmId, projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project || project.pm_id !== pmId) {
    throw ApiError.notFound("Project not found.");
  }
  return project;
}

/**
 * Creates a new PENDING milestone for one contractor on one of the
 * calling PM's own projects — POST /api/pm/milestones. `pmId` is
 * req.user.userId off the JWT; project ownership is enforced here
 * (assertOwnedProject), never left to the client.
 *
 * The contractor must actually be assigned to this project
 * (project_assignments) — checked the same way
 * contractorTimesheetService.submitTimesheet checks it, and with the
 * same 404 (never confirming whether the project or the contractor
 * exists, only that this specific project+contractor combination isn't
 * valid for the caller).
 *
 * After insert, immediately runs the SAME evaluation
 * (milestoneService.evaluateMilestonesForContractorProject) the
 * timesheet-approval hook uses — a PM creating a milestone with a
 * threshold the contractor has already cleared (e.g. backfilling a
 * milestone for hours approved before Module 5 existed, or simply
 * setting a low threshold) must not have to wait for the contractor's
 * next approved timesheet to see it billed. This call can never throw
 * (see that function's own doc comment) and never rolls back the
 * milestone that was just created.
 */
async function createMilestone(pmId, { projectId, contractorId, name, thresholdHours }) {
  await assertOwnedProject(pmId, projectId);

  const isAssigned = await assignmentRepository.existsFor(contractorId, projectId);
  if (!isAssigned) {
    throw ApiError.notFound("Contractor is not assigned to this project.");
  }

  const milestoneId = await milestoneRepository.create({ projectId, contractorId, name, thresholdHours });

  await milestoneService.evaluateMilestonesForContractorProject(projectId, contractorId);

  return findMilestoneView(projectId, milestoneId);
}

/**
 * Lists every milestone (across every contractor staffed on it) for one
 * of the calling PM's own projects — GET /api/pm/milestones/:projectId.
 * Same ownership boundary as createMilestone above.
 */
async function listMilestones(pmId, projectId) {
  await assertOwnedProject(pmId, projectId);
  return milestoneRepository.listByProject(projectId);
}

/**
 * Re-fetches a single milestone (with its billing snapshot, if MET) for
 * the create-response — reuses listByProject rather than a second query
 * shape, since a project's milestone count is small for the MVP and this
 * keeps the "milestone + billing" view built in exactly one place.
 */
async function findMilestoneView(projectId, milestoneId) {
  const milestones = await milestoneRepository.listByProject(projectId);
  return milestones.find((m) => m.id === milestoneId) || null;
}

module.exports = { createMilestone, listMilestones };
