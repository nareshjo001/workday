import apiClient from "./apiClient";
async function vendors() { return (await apiClient.get("/pm/vendors")).data; }
async function connections() { return (await apiClient.get("/pm/vendor-access")).data; }
async function connect(vendorId, projectId) { return (await apiClient.post("/pm/vendor-access", { vendorId, ...(projectId ? { projectId } : {}) })).data; }
async function remove(vendorId) { await apiClient.delete(`/pm/vendor-access/${vendorId}`); }
async function grant(projectId, vendorId) { return (await apiClient.post(`/pm/projects/${projectId}/vendors`, { vendorId })).data; }
async function removeProject(projectId, vendorId) { await apiClient.delete(`/pm/projects/${projectId}/vendors/${vendorId}`); }
export default { vendors, connections, connect, remove, grant, removeProject };
