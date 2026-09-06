# Testing

Automated integration coverage verifies accepted request IDs, generated IDs, stable validation and not-found error contracts, no plaintext password in an error response, readiness, logger redaction, and recorded request latency.

The complete backend suite passed with the new test plus M02 security tests and the preserved staffing/timesheet/billing/invoice regressions. Frontend tests, lint, and production build passed. `git diff --check` passed.

Manual API checks: request `/api/health/live`, `/api/health/ready`, send a malformed login, and inspect response header/body. Each response has a request ID; malformed requests expose no stack trace or secret.
