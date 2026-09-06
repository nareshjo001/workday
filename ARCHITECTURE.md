# VMS Architecture

## Runtime topology

```text
React SPA (Vite) -> Axios with Bearer JWT -> Express API -> mysql2 connection pool -> MySQL/MariaDB
```

The backend follows `route -> controller -> validator -> service -> repository`. SQL lives in repositories; services own business rules, transactions and locks. The SPA handles navigation and UI state but is not a security boundary.

## Authorization and tenancy

Authentication verifies a signed JWT and attaches `{ userId, role }`. Role middleware rejects wrong-role requests. Services and repository SQL derive ownership from that identity. Sensitive cross-tenant probes intentionally return the same 404 as a missing resource; a wrong route role receives 403.

## Transaction model

Mutating flows use transactions for contractor provisioning, project/requirement creation, batch assignment, allocation, timesheet submit/edit/review, milestone billing, project completion and invoice review. Assignment/allocation lock the project first; assignment then locks requirement and contractors. Timesheet writes lock the active assignment before reading reserved hours. Milestone evaluation locks pending milestones. Conditional updates and unique constraints are the final race backstops.

## Historical compatibility

Migrations 001–016 are forward-only records. Current code preserves legacy company names, former weekly timesheet rows, null legacy allocations, released assignments, old auto-approved invoices, and historical billing/invoice snapshots.

## Current maturity boundaries

Refresh-session rotation, rate limiting, structured logging, durable audit records, CI, and pagination are roadmap work rather than current features.
