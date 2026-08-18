/**
 * Token persistence strategy for the MVP.
 *
 * We store the JWT in localStorage under a single key. This keeps the
 * implementation simple (no server-side session store, no refresh-token
 * rotation) and lets a page reload restore the session without another
 * login.
 *
 * Security trade-off (documented per Module 1 requirements):
 * localStorage is readable by any JavaScript running on the page, so a
 * successful XSS attack could exfiltrate the token. The alternative,
 * an httpOnly cookie, is not vulnerable to token theft via XSS but
 * requires CSRF protection and same-site/domain cookie plumbing between
 * the API and the SPA. For this hackathon MVP we accept the XSS exposure
 * in exchange for a simple, dependency-free flow, and mitigate it by:
 *   - never rendering unsanitized user input as HTML,
 *   - keeping the JWT short-lived (see JWT_EXPIRES_IN),
 *   - not introducing any third-party scripts.
 * If this app moves beyond MVP, migrate to an httpOnly cookie issued by
 * the backend plus CSRF-token protection.
 */
const TOKEN_KEY = "vms_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
