import apiClient from "./apiClient";

async function getDashboard() {
  const { data } = await apiClient.get("/contractor/dashboard");
  return data;
}

export default { getDashboard };
