import apiClient from "./apiClient";

async function signup({ name, email, password, role, companyName }) {
  const { data } = await apiClient.post("/auth/signup", {
    name,
    email,
    password,
    role,
    // Only meaningful (and only required by the backend) for role = PM —
    // sent as-is for other roles, the backend simply ignores it.
    companyName,
  });
  return data;
}

async function login({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
}

async function getCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
}

async function refresh() { const { data } = await apiClient.post("/auth/refresh"); return data; }
async function forgotPassword(email) { const { data } = await apiClient.post("/auth/forgot-password", { email }); return data; }
async function resetPassword(token, password) { await apiClient.post("/auth/reset-password", { token, password }); }
async function setupPassword(token, password) { await apiClient.post("/auth/setup-password", { token, password }); }
async function logoutAll() { await apiClient.post("/auth/logout-all"); }
async function logout() { await apiClient.post("/auth/logout"); }

export default { signup, login, refresh, forgotPassword, resetPassword, setupPassword, logout, logoutAll, getCurrentUser };
