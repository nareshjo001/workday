# Audit

## Findings and fixes

**High — access JWTs originally survived refresh-session revocation until expiry.** The session id is now embedded in each access token and `authenticate` verifies that the session remains active. Logout-all test coverage confirms immediate access-token rejection.

**Medium — the initial migration used `ADD COLUMN IF NOT EXISTS`, unsupported by the project’s local MySQL-compatible test server.** The forward-only migration now uses portable `ADD COLUMN` statements. It is applied once in chronological migration order.

**Medium — old contractor UI and test fixtures supplied a password.** Production validation rejects it and the UI no longer displays a password field. A narrowly gated `NODE_ENV=test` compatibility input keeps existing historical regression scripts executable; it is not available in deployed environments.

## Security and architecture review

Helmet, a 100 KB body limit, strict configured CORS origins, auth-specific rate limits, and progressive account lockout are installed at the HTTP boundary. Controllers do not trust actor IDs; protected operations continue to use JWT-derived identity and existing 401/403/404 patterns. Raw tokens are only present in HttpOnly cookies or email/outbox content, never stored as plaintext or returned by normal endpoints.

Refresh rotation and action consumption maintain transaction boundaries and `FOR UPDATE` locking. Unique token hashes provide a final duplicate backstop. Password reset and setup revoke all sessions without changing assignment, timesheet, billing, invoice, or other historical data.

## Deferred

M03 owns structured logging, therefore this module deliberately does not add token-redaction logging infrastructure. SMTP delivery retries beyond vendor-initiated resend belong to operational delivery work and require a future roadmap decision; this module preserves a safe replacement/resend path.
