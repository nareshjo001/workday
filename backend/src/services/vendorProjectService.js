const { pool } = require("../config/db");
const projectRepository = require("../repositories/projectRepository");
const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
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

/**
 * `contractorsByRequirement` is an OPTIONAL Map<requirement_id, row[]> —
 * only getProjectDetail below looks it up and passes it in (see that
 * function's comment for why). listAvailableProjects's browse-list cards
 * never need per-contractor detail, so every requirement there simply
 * gets an empty `contractors` array at effectively no extra cost (no
 * lookup happens when the map isn't provided).
 */
function toRequirementView(row, contractorsByRequirement) {
  const contractors = contractorsByRequirement?.get(row.id) || [];
  return {
    id: row.id,
    skill: row.skill,
    required_count: row.required_count,
    assigned_count: row.assigned_count,
    contractors: contractors.map((c) => ({
      contractor_id: c.contractor_id,
      name: c.contractor_name,
      skill: c.contractor_skill,
      status: c.contractor_status,
      // Project hours/allocation redesign additions — powers the
      // extended Vendor "Project Team" modal table (Contractor/Skill/
      // Allocated/Worked/Remaining), never present before this redesign.
      allocated_hours: c.allocated_hours,
      assignment_status: c.assignment_status,
      released_at: c.released_at,
      logged_hours: c.logged_hours,
      approved_hours: c.approved_hours,
      pending_hours: c.pending_hours,
      remaining_hours: c.remaining_hours,
    })),
  };
}

/**
 * `hoursMetrics` is an OPTIONAL { allocatedHours, approvedHours } pair —
 * see pmProjectService.toProjectView's identical convention. Kept as a
 * parallel (not shared) implementation because the two services read
 * from slightly different row/ownership shapes, same "small duplication
 * over a cross-role coupling" tradeoff this codebase already makes for
 * deriveStaffingStatus itself.
 */
function toProjectView(row, requirements, contractorsByRequirement, hoursMetrics) {
  const totalRequired = requirements.reduce((sum, r) => sum + r.required_count, 0);
  const totalAssigned = requirements.reduce((sum, r) => sum + r.assigned_count, 0);

  const expectedHours = row.expected_hours === null || row.expected_hours === undefined ? null : Number(row.expected_hours);
  const allocatedHours = Number(hoursMetrics?.allocatedHours ?? 0);
  const approvedHours = Number(hoursMetrics?.approvedHours ?? 0);
  const remainingAllocationHours = expectedHours === null ? null : Math.max(0, expectedHours - allocatedHours);
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
    requirements: requirements.map((r) => toRequirementView(r, contractorsByRequirement)),
    total_required: totalRequired,
    total_assigned: totalAssigned,
    staffing_status: deriveStaffingStatus(requirements),
    expected_hours: expectedHours,
    allocated_hours: allocatedHours,
    remaining_allocation_hours: remainingAllocationHours,
    approved_hours: approvedHours,
    work_progress_percent: workProgressPercent,
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
    toProjectView(p, requirementsByProject.get(p.id) || [], null, {
      allocatedHours: allocatedByProject.get(p.id) || 0,
      approvedHours: approvedByProject.get(p.id) || 0,
    })
  );
}

/**
 * A single project's detail (name/company/PM/dates/requirements with
 * live assigned counts, PLUS per-requirement contractor rosters with
 * hours) for GET /api/vendor/projects/:id/requirements — the screen a
 * vendor lands on after clicking a project from their browse list
 * ("View Team"), before drilling into one requirement to assign. Same
 * visibility rule as listAvailableProjects (ACTIVE + not past its end
 * date) — a Vendor shouldn't be able to reach a requirements/assignment
 * screen for a project that wouldn't have shown up in their list in the
 * first place, e.g. by guessing an id.
 *
 * The per-requirement `contractors` array (name/skill/status/logged &
 * approved hours) is what powers the frontend's "Project Team" modal —
 * this deliberately EXTENDS the existing endpoint's response rather than
 * adding a new GET /vendor/projects/:id/team endpoint, since the two
 * screens (staffing progress and team roster) are the same modal and the
 * same underlying project+contractors data, just rendered together. A
 * separate endpoint would mean two round trips and two places enforcing
 * the same "is this project visible to vendors" check above; this way
 * there is exactly one.
 */
async function getProjectDetail(projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  if (project.status !== "ACTIVE" || (project.end_date && project.end_date < todayDateString())) {
    throw ApiError.notFound("Project not found.");
  }

  const [requirements, contractorRows, allocatedHours, approvedHours] = await Promise.all([
    projectRepository.listRequirementsWithCounts([projectId]),
    assignmentRepository.listAssignedContractorsWithHours(projectId),
    assignmentRepository.sumAllocatedHoursForProject(pool, projectId),
    timesheetRepository.sumApprovedHoursForProject(projectId),
  ]);

  const contractorsByRequirement = new Map();
  for (const row of contractorRows) {
    if (!contractorsByRequirement.has(row.requirement_id)) {
      contractorsByRequirement.set(row.requirement_id, []);
    }
    contractorsByRequirement.get(row.requirement_id).push(row);
  }

  return toProjectView(project, requirements, contractorsByRequirement, { allocatedHours, approvedHours });
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
