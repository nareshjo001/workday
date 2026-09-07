import apiClient from "./apiClient";

async function list() { const { data } = await apiClient.get("/contractor/availability"); return data; }
async function create(payload) { const { data } = await apiClient.post("/contractor/availability", payload); return data; }
async function cancel(id) { await apiClient.delete(`/contractor/availability/${id}`); }

export default { list, create, cancel };
