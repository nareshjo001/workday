// Keep access tokens in memory; restore sessions through the HttpOnly refresh cookie.
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
