import axios from "axios";
import { getToken, setToken, clearToken } from "../utils/tokenStorage";

/**
 * Centralized Axios instance. All API services (authService, and future
 * projectService/timesheetService/invoiceService, etc.) should be built on
 * top of this client rather than issuing their own axios/fetch calls.
 */
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
    // An access token lives only in memory. A single cookie-backed refresh
    // restores it after a reload or expiry, without putting a long-lived
    // credential in browser storage.
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
      // Session is invalid/expired — drop the stale token so the app
      // treats the user as logged out on the next auth check.
      clearToken();
    }
    return Promise.reject(normalizeApiError(error));
  }
);

/**
 * Converts an axios error into a plain, UI-friendly shape so components
 * never need to reach into error.response.data themselves.
 */
function normalizeApiError(error) {
  if (error.response) {
    const { data, status } = error.response;
    return {
      status,
      message: data?.message || "Something went wrong. Please try again.",
      errors: data?.errors || null,
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
