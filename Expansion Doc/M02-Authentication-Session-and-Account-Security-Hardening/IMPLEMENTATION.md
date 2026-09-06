# Implementation

## End-to-end flows

Login validates a normalized email and password, applies generic failure messages, records progressive failures, creates an `auth_sessions` row inside a transaction, and returns a short access token plus an HttpOnly refresh cookie. Each access JWT contains the session id; middleware verifies both JWT signature and an active session row.

Refresh locks the presented session row with `SELECT ... FOR UPDATE`, creates the replacement session, revokes the previous row, and commits as one transaction. Logout revokes its cookie session. Logout-all and successful password setup/reset revoke every active session for that user.

Forgot password always returns `202`. If an account exists, a random action token is generated, only its SHA-256 hash is stored in `auth_action_tokens`, and the mail abstraction delivers the raw link. Consumption locks and marks the action token used before changing the password, preventing replay. A new token revokes an earlier unused token with the same purpose.

Vendor
  ↓
Create contractor identity and profile
  ↓
Commit identity transaction
  ↓
Create hashed invitation token and send setup link
  ↓
Contractor sets own password
  ↓
Invitation consumed and all older sessions revoked

## Delivery

`mailService` uses Nodemailer when SMTP is configured. With no SMTP configuration it uses a deterministic in-memory development/test outbox. This supports local recovery/invitation testing without a provider and keeps provider details outside business services. A failed SMTP send leaves the identity/token record intact; the vendor resend route safely replaces the active invitation.

## Frontend

The SPA holds only the access JWT in memory. Axios sends cookies and performs one refresh attempt after a 401. Auth startup restores from `/auth/refresh`; unrecoverable expiry clears local state. Forgot-password, reset-password, and setup-password screens display loading, success, and error states. The contractor modal no longer accepts a password and explains the invitation action.

## Schema and locking

Migration `017_auth_sessions_tokens_and_invitations.sql` adds lockout fields to `users`, `auth_sessions`, and `auth_action_tokens`. Unique token-hash indexes prevent duplicate raw-hash records. Refresh and action consumption use a transaction and locked read; action-token use is set before password mutation. Historical user passwords and VMS financial history are untouched.
