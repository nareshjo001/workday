/**
 * Short-lived access token storage. The token is intentionally memory-only;
 * page restoration uses the HttpOnly refresh cookie and /auth/refresh.
 */
let accessToken = null;

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token;
}

export function clearToken() {
  accessToken = null;
}
