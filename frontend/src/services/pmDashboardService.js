import apiClient from "./apiClient";

/**
 * PM dashboard/analytics API (UI + analytics redesign). Same
 * conventions as vendorDashboardService.js.
 */
async function getDashboard(params = {}) {
  const { data } = await apiClient.get("/pm/dashboard", { params });
  return data;
}

export default { getDashboard };
