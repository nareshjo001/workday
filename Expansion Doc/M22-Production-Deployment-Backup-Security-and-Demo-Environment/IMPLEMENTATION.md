# Implementation

## Runtime topology

`mysql:8.4` stores application data in `mysql-data`. The non-root Node 24 Alpine backend writes documents and invoice PDFs to `document-data`. The frontend builds with Vite and is served by Nginx, which proxies `/api` and falls back to `index.html` for SPA routes. Health dependencies are explicit: MySQL must be healthy before backend/startup tools run, and frontend waits for backend health.

## Migrations and seed

`schema_migrations` records filename, version, SHA-256 checksum, and apply time. The runner applies only unrecorded files, rejects changed recorded migrations, and refuses to replay a legacy schema that lacks the ledger. `--baseline-existing` is an explicit operator action after backup and schema verification. MySQL DDL can implicitly commit, so recovery is backup/restore or a forward fix rather than automatic down migration.

The runner and demo seed retry bounded MySQL connections because a container health probe can precede TCP acceptance. The seed requires `DEMO_SEED_ENABLED=true` and a database name ending in `_demo` or `_restore`; its vendor-email marker makes reruns idempotent. It creates Vendor, PM, two Contractors, a project, requirements, compliance documents, candidate decisions, assignment, approved/rejected/submitted timesheets, milestone billing, an approved overdue partial-paid invoice, and a frozen invoice PDF.

## Environment and storage

Production rejects weak placeholder JWT secrets and wildcard CORS. `CLIENT_ORIGIN` is an allowlist. Refresh cookies are Secure only in production; deployment therefore requires HTTPS for browser refresh sessions. `DOCUMENT_STORAGE_PATH` and `UPLOAD_MAX_BYTES` centralize local file storage and size policy. The Compose document volume persists generated PDFs and contractor documents through backend restart.

## Browser completion fix

E2E preparation found that the API supported PM candidate decisions but the PM UI lacked an individual review action. M22 adds the small review queue to the existing staffing page. It calls the existing PM candidate API, shows a required rejection reason, and reloads the scoped queue. No candidate backend lifecycle semantics changed.
