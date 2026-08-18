import axios from "axios";
import { getToken, clearToken } from "../utils/tokenStorage";

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
  (error) => {
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
