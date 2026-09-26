import apiClient from "./apiClient";

async function getDashboard(params = {}) {
  const { data } = await apiClient.get("/pm/dashboard", { params });
  return data;
}

export default { getDashboard };
