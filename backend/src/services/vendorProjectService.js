const projectRepository = require("../repositories/projectRepository");
const contractorRepository = require("../repositories/contractorRepository");
const ApiError = require("../utils/ApiError");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Same derivation as pmProjectService.deriveStaffingStatus — kept as a
 * separate small copy rather than a shared import because the two
 * call sites read from slightly different row shapes and this is a
 * three-line pure function, not something worth an extra module for.
 */
function deriveStaffingStatus(requirements) {
  if (requirements.length === 0) return "PENDING";
  const fullyStaffed = requirements.every((r) => r.assigned_count >= r.required_count);
  return fullyStaffed ? "FULLY_STAFFED" : "PENDING";
}

function toRequirementView(row) {
  return {
    id: row.id,
    skill: row.skill,
    required_count: row.required_count,
    assigned_count: row.assigned_count,
  };
}

function toProjectView(row, requirements) {
  const totalRequired = requirements.reduce((sum, r) => sum + r.required_count, 0);
  const totalAssigned = requirements.reduce((sum, r) => sum + r.assigned_count, 0);

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
  };
}

/**
 * Projects a Vendor can currently browse to staff. Per Module 3 revision
 * spec sections 9-10: NO vendor_projects relationship exists, so this
 * intentionally returns the same list to every vendor — the ownership
 * boundary is enforced later, at assignment time, by scoping which
 * CONTRACTORS a vendor may put on a project, not which projects they may
 * see. Excludes COMPLETED/ON_HOLD/expired projects (projectRepository
 * already filters those out in SQL); fully-staffed ACTIVE projects are
 * still included so a vendor can see "0 open slots" rather than the
 * project silently disappearing.
 */
async function listAvailableProjects() {
  const projects = await projectRepository.listAvailableForVendor();
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const requirementRows = await projectRepository.listRequirementsWithCounts(projectIds);

  const requirementsByProject = new Map();
  for (const row of requirementRows) {
    if (!requirementsByProject.has(row.project_id)) requirementsByProject.set(row.project_id, []);
    requirementsByProject.get(row.project_id).push(row);
  }

  return projects.map((p) => toProjectView(p, requirementsByProject.get(p.id) || []));
}

/**
 * A single project's detail (name/company/PM/dates/requirements with
 * live assigned counts) for GET /api/vendor/projects/:id/requirements —
 * the screen a vendor lands on after clicking a project from their
 * browse list, before drilling into one requirement to assign. Same
 * visibility rule as listAvailableProjects (ACTIVE + not past its end
 * date) — a Vendor shouldn't be able to reach a requirements/assignment
 * screen for a project that wouldn't have shown up in their list in the
 * first place, e.g. by guessing an id.
 */
async function getProjectDetail(projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  if (project.status !== "ACTIVE" || (project.end_date && project.end_date < todayDateString())) {
    throw ApiError.notFound("Project not found.");
  }

  const requirements = await projectRepository.listRequirementsWithCounts([projectId]);
  return toProjectView(project, requirements);
}

/**
 * Contractors this vendor could assign to one specific requirement —
 * GET /api/vendor/projects/:id/requirements/:requirementId/eligible-contractors.
 * Confirms the project is still open for staffing and that the
 * requirement actually belongs to it (never trusts requirementId alone),
 * then delegates the eligibility filter itself (own-vendor, ACTIVE,
 * skill match, not assigned anywhere) to
 * contractorRepository.listEligibleForVendorAndSkill — this is a READ for
 * populating the picker UI, not the concurrency guarantee (see that
 * function's comment).
 */
async function getEligibleContractorsForRequirement(vendorId, projectId, requirementId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  if (project.status !== "ACTIVE" || (project.end_date && project.end_date < todayDateString())) {
    throw ApiError.notFound("Project not found.");
  }

  const requirement = await projectRepository.findRequirementById(projectId, requirementId);
  if (!requirement) {
    throw ApiError.notFound("Requirement not found on this project.");
  }

  const [contractors, [requirementWithCount]] = await Promise.all([
    contractorRepository.listEligibleForVendorAndSkill(vendorId, requirement.skill),
    projectRepository
      .listRequirementsWithCounts([projectId])
      .then((rows) => rows.filter((r) => r.id === requirement.id)),
  ]);

  return {
    requirement: toRequirementView(requirementWithCount || { ...requirement, assigned_count: 0 }),
    eligible_contractors: contractors,
  };
}

module.exports = { listAvailableProjects, getProjectDetail, getEligibleContractorsForRequirement };
