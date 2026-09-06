# M02 — Authentication, Session & Account Security Hardening

M02 replaces the hackathon’s long-lived browser token and vendor-selected contractor password flow with a production-shaped account-security model.

Access tokens are short lived and kept only in browser memory. A rotating HttpOnly refresh cookie restores a session after a page reload. The server records each session, so logout, logout-all, password reset, and refresh-token reuse immediately invalidate the relevant credentials.

Vendors now create a contractor profile and send a one-time setup invitation. The contractor chooses their own password. Password recovery uses the same password rule and returns the same response whether or not an email exists.

Important rules:

- Raw refresh and action tokens are never stored in MySQL or normal API responses.
- A revoked server-side session invalidates its access token before JWT expiry.
- Reset and invitation tokens are purpose-scoped, expiring, single use, and replaced on resend.
- Vendor identity and contractor ownership still come from the authenticated JWT, never request fields.
