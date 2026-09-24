import apiClient from "./apiClient";

async function setup() {
  const [clients, skills] = await Promise.all([
    apiClient.get("/vendor/clients"),
    apiClient.get("/vendor/rate-card-skills"),
  ]);
  return { clients: clients.data.items || [], skills: skills.data.items || [] };
}

async function list(clientCompanyId) {
  const { data } = await apiClient.get(`/vendor/clients/${clientCompanyId}/rate-cards`);
  return data.items || [];
}

async function create(payload) {
  const { data } = await apiClient.post("/vendor/rate-cards", payload);
  return data;
}

export default { setup, list, create };
