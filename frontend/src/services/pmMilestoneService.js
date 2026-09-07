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
 *
 * PROJECT-LEVEL REDESIGN: no contractorId anymore — a milestone is a
 * project-wide checkpoint every staffed contractor contributes toward
 * (see CreateMilestoneModal / pmMilestoneValidators).
 */
async function createMilestone({ projectId, name, thresholdHours, description, sequenceOrder, dueDate }) {
  const { data } = await apiClient.post("/pm/milestones", {
    project_id: projectId,
    name,
    threshold_hours: thresholdHours,
    description, sequence_order: sequenceOrder || null, due_date: dueDate || null,
  });
  return data;
}
async function updateMilestone(id,{name,thresholdHours,description,sequenceOrder,dueDate}){const {data}=await apiClient.patch(`/pm/milestones/${id}`,{name,threshold_hours:thresholdHours,description,sequence_order:sequenceOrder||null,due_date:dueDate||null});return data;}

export default { listMilestones, createMilestone, updateMilestone };
