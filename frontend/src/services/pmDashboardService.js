import apiClient from "./apiClient";

/**
 * PM dashboard/analytics API (UI + analytics redesign). Same
 * conventions as vendorDashboardService.js.
 */
async function getDashboard() {
  const { data } = await apiClient.get("/pm/dashboard");
  return data;
}

export default { getDashboard };
