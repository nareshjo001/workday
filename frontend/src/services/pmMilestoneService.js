import apiClient from "./apiClient";

/**
 * PM's milestone-management API (Module 5). Built on the shared
 * apiClient, same as pmProjectService/pmTimesheetService — the JWT is
 * attached automatically, so nothing here ever passes a pm id explicitly.
 */

async function listMilestones(projectId) {
  const { data } = await apiClient.get(`/pm/milestones/${projectId}`);
  return data;
}

/**
 * `thresholdHours` is sent as threshold_hours to match the backend's
 * snake_case body convention for this endpoint (see
 * pmMilestoneValidators.validateCreateMilestone) — same camelCase-in/
 * snake_case-out translation pmProjectService.createProject already does
 * for requirements.
 */
async function createMilestone({ projectId, contractorId, name, thresholdHours }) {
  const { data } = await apiClient.post("/pm/milestones", {
    project_id: projectId,
    contractor_id: contractorId,
    name,
    threshold_hours: thresholdHours,
  });
  return data;
}

export default { listMilestones, createMilestone };
