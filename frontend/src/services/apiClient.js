import axios from "axios";
import { getToken, setToken, clearToken } from "../utils/tokenStorage";

// Use the shared client for API requests and authentication handling.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    // Restore memory-only access tokens through one cookie-backed refresh request.
    if (error.response?.status === 401 && request && !request._retried && !request.url?.includes("/auth/refresh")) {
      request._retried = true;
      try {
        const { data } = await apiClient.post("/auth/refresh", null, { _retried: true });
        setToken(data.token);
        request.headers.Authorization = `Bearer ${data.token}`;
        return apiClient(request);
      } catch {
        clearToken();
      }
    }
    if (error.response?.status === 401) {
      // Drop stale tokens after session restoration fails.
      clearToken();
    }
    return Promise.reject(normalizeApiError(error));
  }
);

// Normalize API errors into a consistent shape for components.
function normalizeApiError(error) {
  if (error.response) {
    const { data, status } = error.response;
    return {
      status,
      message: data?.message || "Something went wrong. Please try again.",
      errors: data?.details || data?.errors || null,
      code: data?.code || null,
      requestId: data?.request_id || null,
    };
  }
  if (error.request) {
    return {
      status: 0,
      message: "Unable to reach the server. Check your connection and try again.",
      errors: null,
    };
  }
  return { status: -1, message: error.message || "Unexpected error.", errors: null };
}

export default apiClient;
