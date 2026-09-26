import apiClient from "./apiClient";

// Derive contractor identity server-side from the authenticated session.
async function getProfile() {
  const { data } = await apiClient.get("/contractor/profile");
  return data;
}

async function updateProfile(profile) {
  const { data } = await apiClient.patch("/contractor/profile", profile);
  return data;
}

export default { getProfile, updateProfile };
