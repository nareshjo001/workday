import apiClient from "./apiClient";

async function signup({ name, email, password, role }) {
  const { data } = await apiClient.post("/auth/signup", { name, email, password, role });
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

export default { signup, login, getCurrentUser };
