import apiClient from "./apiClient";

// Fetch dashboard metrics for the authenticated vendor without sending an identity parameter.
async function getDashboard(params = {}) {
  const { data } = await apiClient.get("/vendor/dashboard", { params });
  return data;
}

export default { getDashboard };
