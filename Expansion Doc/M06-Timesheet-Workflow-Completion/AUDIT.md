# Audit

## Final status

PASS — the M06 implementation follows the existing route → controller → validator → service → repository architecture and preserves financial, RBAC, tenancy, and historical-data invariants.

## Findings and fixes

### MEDIUM — old drafts could otherwise be submitted after release or completion

**Why it mattered:** a draft created while an assignment was active could become newly pending work after that contractor had been released or the project completed.

**Fix:** selected submission now requires an active contractor, active assignment, and active project within the transaction. Project IDs are processed in deterministic ascending order.

### MEDIUM — draft timestamps could misleadingly appear submitted

**Why it mattered:** the historical `submitted_at` default stamped a time on newly created drafts.

**Fix:** the migration makes `submitted_at` nullable with no default; creation leaves it null and selected submission sets it.

### LOW — rejection collection used a browser prompt

**Why it mattered:** it provided weak validation and poor recovery UX.

**Fix:** a controlled rejection modal requires a nonblank explanation and displays errors in the application UI.

## Review areas

- **RBAC and tenancy:** server-side JWT identity, role middleware, PM project join ownership, and generic cross-PM 404 behavior are retained.
- **Privacy:** descriptions and rejection reasons are bounded; no tokens, credentials, or headers enter timesheet or audit snapshots.
- **Transactions/concurrency:** submission and bulk review are transactional, lock deterministically, use conditional state updates, and preserve audit rollback behavior.
- **Financial integrity:** only `APPROVED` remains billable; no billing query was broadened to drafts or submitted rows.
- **Frontend/backend contract:** frontend sends `description`, `timesheetIds`, and camel-case `rejectionReason` matching backend validation. The OpenAPI file was updated.

No unresolved M06 findings remain. Existing generic lint warnings are outside M06 and were not changed.
