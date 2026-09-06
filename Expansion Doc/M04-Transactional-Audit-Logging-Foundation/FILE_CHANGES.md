# File changes

Added files:

- `backend/src/migrations/018_audit_log.sql` — audit-log schema and lookup indexes.
- `backend/src/repositories/auditRepository.js` — parameterized append-only insert.
- `backend/src/services/auditService.js` — transaction-aware audit boundary.
- `backend/test/integration/audit-log.test.js` — audit, rollback, snapshot, and redaction coverage.
- `Expansion Doc/M04-Transactional-Audit-Logging-Foundation/*` — module documentation.

Modified files:

- Relevant controllers/services/repositories for contractor, project, assignment, timesheet, milestone, and invoice mutations — pass request context and append audit rows inside their transactions.

Deleted files: None.
