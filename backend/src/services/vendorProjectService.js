const { pool } = require("../config/db");
const projectRepository = require("../repositories/projectRepository");
const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const ApiError = require("../utils/ApiError");
const { pageResult } = require("../utils/listQuery");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function deriveStaffingStatus(requirements) {
  if (requirements.length === 0) return "PENDING";
  const fullyStaffed = requirements.every((r) => r.assigned_count >= r.required_count);
  return fullyStaffed ? "FULLY_STAFFED" : "PENDING";
}

// Only detail views supply contractor rosters; browse views avoid the extra lookup.
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

// Use server-computed hour metrics in the vendor project view.
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

async function listAvailableProjectsPage(query, vendorId) {
  const { rows, total } = await projectRepository.listAvailablePageForVendor(query, vendorId);
  if (!rows.length) return pageResult([], total, query);
  const ids = rows.map((row) => row.id); const [requirements, allocated, approved] = await Promise.all([projectRepository.listRequirementsWithCounts(ids), assignmentRepository.sumAllocatedHoursForProjects(ids), timesheetRepository.sumApprovedHoursForProjects(ids)]);
  const byProject = new Map(); for (const row of requirements) { if (!byProject.has(row.project_id)) byProject.set(row.project_id, []); byProject.get(row.project_id).push(row); }
  const allocation = new Map(allocated.map((row) => [row.project_id, row.allocated_hours])); const approvals = new Map(approved.map((row) => [row.project_id, row.approved_hours]));
  return pageResult(rows.map((row) => toProjectView(row, byProject.get(row.id) || [], null, { allocatedHours: allocation.get(row.id) || 0, approvedHours: approvals.get(row.id) || 0 })), total, query);
}

// Verify vendor project access before returning requirements and contractor rosters.
async function getProjectDetail(projectId, vendorId) {
  if (!(await require('../repositories/vendorAccessRepository').hasProjectAccess(projectId, vendorId))) throw ApiError.notFound("Project not found.");
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

// Verify project access and requirement membership before listing the vendor's eligible contractors.
async function getEligibleContractorsForRequirement(vendorId, projectId, requirementId) {
  if (!(await require('../repositories/vendorAccessRepository').hasProjectAccess(projectId, vendorId))) throw ApiError.notFound("Project not found.");
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
    contractorRepository.listEligibleForVendorAndSkill(vendorId, requirement.skill, todayDateString(), project.end_date || null),
    projectRepository
      .listRequirementsWithCounts([projectId])
      .then((rows) => rows.filter((r) => r.id === requirement.id)),
  ]);

  return {
    requirement: toRequirementView(requirementWithCount || { ...requirement, assigned_count: 0 }),
    eligible_contractors: contractors,
  };
}

module.exports = { listAvailableProjectsPage, getProjectDetail, getEligibleContractorsForRequirement };
