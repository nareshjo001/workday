import apiClient from "./apiClient";

/**
 * Contractor's own profile API. No id is ever passed — the backend
 * derives the contractor from the JWT, same pattern as
 * contractorProjectService.
 */
async function getProfile() {
  const { data } = await apiClient.get("/contractor/profile");
  return data;
}

async function updateSkill(skill) {
  const { data } = await apiClient.patch("/contractor/profile/skill", { skill });
  return data;
}

export default { getProfile, updateSkill };
