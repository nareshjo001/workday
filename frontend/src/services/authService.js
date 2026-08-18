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

export default { signup, login, getCurrentUser };
