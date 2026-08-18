import apiClient from "./apiClient";

/**
 * PM's project-management API. Built on the shared apiClient, same as
 * authService/vendorContractorService — the JWT is attached automatically,
 * so nothing here ever passes a pm id explicitly.
 */

async function listProjects() {
  const { data } = await apiClient.get("/pm/projects");
  return data;
}

/**
 * `requirements` is [{ skill, requiredCount }, ...] — translated to the
 * backend's { skill, required_count } shape here so page/component code
 * can stay in camelCase like the rest of the frontend.
 *
 * company_name is NO LONGER sent — a project's client company is derived
 * server-side from the creating PM's own company association (set at PM
 * signup), not typed per-project. See CreateProjectModal.
 */
async function createProject({ name, description, startDate, endDate, requirements }) {
  const { data } = await apiClient.post("/pm/projects", {
    name,
    description: description || undefined,
    start_date: startDate,
    end_date: endDate || undefined,
    requirements: requirements.map((r) => ({
      skill: r.skill,
      required_count: r.requiredCount,
    })),
  });
  return data;
}

export default { listProjects, createProject };
