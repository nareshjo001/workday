import apiClient from "./apiClient";

/**
 * Vendor's contractor-management API. Built on the shared apiClient, same
 * as authService — the JWT is attached automatically by apiClient's
 * request interceptor, so nothing here ever needs to read the token or
 * pass a vendor id explicitly. The backend derives the vendor from the
 * token on every call.
 */

async function listContractors() {
  const { data } = await apiClient.get("/vendor/contractors");
  return data;
}

async function createContractor({ name, email, password, hourlyRate }) {
  const { data } = await apiClient.post("/vendor/contractors", {
    name,
    email,
    password,
    hourly_rate: hourlyRate,
  });
  return data;
}

async function updateContractor(id, { hourlyRate, status }) {
  const body = {};
  if (hourlyRate !== undefined) body.hourly_rate = hourlyRate;
  if (status !== undefined) body.status = status;

  const { data } = await apiClient.patch(`/vendor/contractors/${id}`, body);
  return data;
}

export default { listContractors, createContractor, updateContractor };
