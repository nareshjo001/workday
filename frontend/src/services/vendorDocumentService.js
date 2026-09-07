import apiClient from "./apiClient";
async function list(contractorId) { const { data } = await apiClient.get(`/vendor/contractors/${contractorId}/documents`); return data; }
async function upload(payload) { const { data } = await apiClient.post("/vendor/contractor-documents", payload); return data; }
async function review(id, payload) { const { data } = await apiClient.patch(`/vendor/contractor-documents/${id}/review`, payload); return data; }
export default { list, upload, review };
