import apiClient from "./apiClient";

async function listForPm() {
  const { data } = await apiClient.get("/pm/candidate-submissions");
  return data.items;
}

async function decide(id, status, reason) {
  const { data } = await apiClient.patch(`/pm/candidate-submissions/${id}`, {
    status,
    ...(reason ? { reason } : {}),
  });
  return data;
}

export default { listForPm, decide };
