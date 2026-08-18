const projectRepository = require("../repositories/projectRepository");
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
 * Creates a new PENDING, PROJECT-LEVEL milestone on one of the calling
 * PM's own projects — POST /api/pm/milestones. `pmId` is req.user.userId
 * off the JWT; project ownership is enforced here (assertOwnedProject),
 * never left to the client.
 *
 * PROJECT-LEVEL REDESIGN: there is no contractor picker anymore — a
 * milestone is a project-wide cumulative-approved-hours checkpoint, met
 * when the SUM of every contractor's approved hours on this project
 * crosses the threshold (see milestoneService.checkAndTriggerMilestones).
 * The only new validation this layer adds beyond
 * pmMilestoneValidators' shape checks is threshold_hours <=
 * project.expected_hours — a milestone whose threshold exceeds the
 * project's own total capacity could never be met, and thresholds are
 * cumulative checkpoints toward expected_hours, not additive amounts
 * summed across milestones (a project can have M1=50h, M2=100h, M3=150h
 * on a 150h project; each threshold on its own must still fit within
 * expected_hours). expected_hours must actually be set on the project
 * for this check to run at all — a project created before this
 * migration (expected_hours NULL) has no ceiling to validate against, so
 * a milestone can still be created for it (the same "legacy row, don't
 * assume you can reconstruct a value that was never captured" stance
 * this codebase takes elsewhere).
 *
 * After insert, immediately runs the SAME evaluation
 * (milestoneService.checkAndTriggerMilestones) the timesheet-approval
 * hook uses — a PM creating a milestone with a threshold the project has
 * already cleared (e.g. backfilling a milestone for hours approved
 * before this milestone existed, or simply setting a low threshold) must
 * not have to wait for the next approved timesheet to see it billed.
 * This call can never throw (see that function's own doc comment) and
 * never rolls back the milestone that was just created.
 */
async function createMilestone(pmId, { projectId, name, thresholdHours }) {
  const project = await assertOwnedProject(pmId, projectId);

  if (project.expected_hours !== null && thresholdHours > Number(project.expected_hours)) {
    throw ApiError.badRequest("Validation failed", [
      `threshold_hours (${thresholdHours}) cannot exceed the project's expected_hours (${Number(
        project.expected_hours
      )}).`,
    ]);
  }

  const milestoneId = await milestoneRepository.create({ projectId, name, thresholdHours });

  await milestoneService.checkAndTriggerMilestones(projectId);

  return findMilestoneView(projectId, milestoneId);
}

/**
 * Lists every milestone for one of the calling PM's own projects, each
 * with its full per-contractor contribution breakdown —
 * GET /api/pm/milestones/:projectId. Same ownership boundary as
 * createMilestone above.
 */
async function listMilestones(pmId, projectId) {
  await assertOwnedProject(pmId, projectId);
  return milestoneRepository.listByProject(projectId);
}

/**
 * Re-fetches a single milestone (with its contribution rows, if MET) for
 * the create-response — reuses listByProject rather than a second query
 * shape, since a project's milestone count is small for the MVP and this
 * keeps the "milestone + contributions" view built in exactly one place.
 */
async function findMilestoneView(projectId, milestoneId) {
  const milestones = await milestoneRepository.listByProject(projectId);
  return milestones.find((m) => m.id === milestoneId) || null;
}

module.exports = { createMilestone, listMilestones };
