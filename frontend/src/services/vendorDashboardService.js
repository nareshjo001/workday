import apiClient from "./apiClient";

/**
 * Vendor dashboard/analytics API (UI + analytics redesign). One GET,
 * same shared apiClient/JWT convention as every other service — the
 * backend derives the vendor's identity from the token, never from
 * anything sent here.
 */
async function getDashboard() {
  const { data } = await apiClient.get("/vendor/dashboard");
  return data;
}

export default { getDashboard };
