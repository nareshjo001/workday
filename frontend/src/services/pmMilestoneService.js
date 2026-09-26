import apiClient from "./apiClient";

// Use session-derived PM identity for project milestone requests.

async function listMilestones(projectId) {
  const { data } = await apiClient.get(`/pm/milestones/${projectId}`);
  return data;
}

// Translate project-level milestone fields to the API's snake_case payload.
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
