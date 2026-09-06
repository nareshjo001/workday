# Testing

Automated backend integration tests run against a reset database ending in `_test` and cover login, refresh rotation and reuse rejection, logout-all access-token invalidation, generic recovery responses, hashed reset-token storage, wrong-purpose/expired/replayed reset links, contractor invitations, resend replacement, invite replay rejection, contractor-owned password setup, and progressive lockout.

The complete legacy regression suite remains green: 91 checks for allocation, timesheets, milestone billing, invoices, release, and concurrency, plus 20 released-contractor eligibility checks. Backend coverage remains above the existing gate (40% lines/functions and 30% branches).

Frontend Vitest covers protected routes and one-time password-link handling, including URL-token use without rendering the token and client-side minimum-password validation. Frontend lint completes with existing Fast Refresh warnings only, and the production build passes.

Manual E2E exercised through the same live API workflow:

- Vendor creates contractor, deterministic outbox supplies invitation, contractor sets password, and logs in.
- Recovery returns the same response for known and unknown email; reset succeeds once and replay fails.
- Refresh rotates the cookie, old cookie fails, logout-all invalidates refresh and access credentials.
