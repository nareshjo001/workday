# Implementation

`018_audit_log.sql` creates the append-only `audit_log` table with entity/time and actor/time indexes. It stores JSON snapshots and no normal update or delete repository/API exists.

Request context supplies `requestId`; controllers pass the authenticated JWT actor plus that ID to services. `auditService.write(conn, ...)` delegates to the repository using the caller's existing transaction connection. The business write and audit insert commit together or roll back together.

Audited actions: `CONTRACTOR_CREATED`, `CONTRACTOR_UPDATED`, `PROJECT_CREATED`, `ASSIGNMENT_CREATED`, `ASSIGNMENT_ALLOCATION_CHANGED`, `TIMESHEET_SUBMITTED`, `TIMESHEET_RESUBMITTED`, `TIMESHEET_REVIEWED`, `MILESTONE_CREATED`, `MILESTONE_MET`, `INVOICE_REVIEWED`, and `PROJECT_COMPLETED`.

Snapshots contain only decision-relevant scalar metadata. They intentionally exclude password hashes, action tokens, refresh tokens, cookies, authorization headers, document content, and binary data. Existing ownership checks, 403 role gates, 404 tenant-probing conventions, conditional updates, unique constraints, and `FOR UPDATE` lock order remain the security/concurrency boundary.

Milestone evaluation remains its own transaction after approval; a milestone transition and its audit row are atomic with each other. The originating PM request ID/actor is propagated to that evaluation. Delivery/observability events and unimplemented future-module domains are not retroactively represented as M04 audit mutations.
