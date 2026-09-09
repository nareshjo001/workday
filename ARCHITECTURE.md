# VMS Final Architecture

## Runtime topology

```text
Browser -> Nginx SPA /api proxy -> Express API -> mysql2 pool -> MySQL 8
                                   |-> persistent document/PDF volume
```

The application is a modular monolith. Backend flow is `route -> controller -> validator -> service -> repository`; services own transactions and domain rules. React manages UI state and routing but is never an authorization boundary.

The portfolio-ready architecture, final ERD, complete business workflow, and concurrency/lock table are maintained in [M23 Final Architecture](Expansion%20Doc/M23-Final-Architecture-Audit-Release-and-Internship-Story/FINAL_ARCHITECTURE.md).

## Security and tenancy

JWT access tokens are paired with validated server-side sessions. Role routers gate Vendor, PM, and Contractor APIs. Services and repository SQL derive organization/project scope from the authenticated identity. Wrong-role access is rejected; tenant-sensitive missing/foreign resource probes retain the established hidden-resource behavior.

Helmet, explicit CORS origins, JSON size limits, authentication rate limits, safe error contracts, request IDs, and structured redacted logs are process-level controls. Production rejects placeholder/short JWT secrets and wildcard origins.

## Data integrity

Transactions, `SELECT ... FOR UPDATE`, conditional transitions, and unique constraints protect candidate acceptance, assignment capacity/overlap, timesheet review, milestone billing, invoice numbering/items/review, payments, and project close. M04 audit writes share each critical mutation transaction.

Financial values move from assignment rate snapshots to immutable milestone billing, invoice items/documents, and payments. Later rate card or contractor changes do not rewrite history.

## Operations

Docker Compose contains MySQL, backend, and frontend. Explicit one-shot tools run migrations and demo seed. `schema_migrations` protects the forward-only SQL sequence with file checksums and an operator-only legacy baseline. MySQL and document storage persist in named volumes. See the [M22 deployment record](Expansion%20Doc/M22-Production-Deployment-Backup-Security-and-Demo-Environment/IMPLEMENTATION.md).
