import apiClient from "./apiClient";

/**
 * Contractor dashboard/analytics API (UI + analytics redesign). Same
 * conventions as vendorDashboardService.js.
 */
async function getDashboard() {
  const { data } = await apiClient.get("/contractor/dashboard");
  return data;
}

export default { getDashboard };
