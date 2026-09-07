import apiClient from "./apiClient";

function query(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== "" && value !== null && value !== undefined) params.set(key, value); });
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export async function getPmStaffingPipeline(filters) {
  const { data } = await apiClient.get(`/pm/staffing-pipeline${query(filters)}`);
  return data;
}

export async function getVendorStaffingPipeline(filters) {
  const { data } = await apiClient.get(`/vendor/staffing-pipeline${query(filters)}`);
  return data;
}
