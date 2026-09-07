# Implementation

## Workflow

Contractor
  ↓ save a daily row with optional description
`DRAFT`
  ↓ submit selected rows or a week
`SUBMITTED`
  ↓ PM approves or rejects
`APPROVED` (immutable and billable) or `REJECTED` (reason required)
  ↓ contractor corrects the rejected row
`DRAFT` → explicit resubmission

The browser calls the role-scoped API client, which calls the protected Express route. JWT middleware supplies the actor identity; validators normalize the payload; services enforce business rules; repositories contain SQL; transactions and audit writes protect each mutation.

## Database and compatibility

`020_timesheet_workflow_completion.sql` preserves all daily rows. Former `PENDING` records represent previously submitted work and migrate to `SUBMITTED`. The status enum is now `DRAFT`, `SUBMITTED`, `APPROVED`, or `REJECTED`. `description` and `rejection_reason` are nullable `VARCHAR(1000)` fields. `submitted_at` is nullable so a saved draft has no false submission timestamp. The migration uses information-schema guarded statements for repeat-safe schema application.

No historical approved hours, milestone billing snapshots, or invoices are altered.

## APIs

- `POST /api/contractor/timesheets` saves a daily draft.
- `POST /api/contractor/timesheets/submit` atomically changes owned `DRAFT`/`REJECTED` IDs to `SUBMITTED`.
- `PATCH /api/contractor/timesheets/:id` corrects only an owned rejected row and returns it to `DRAFT`, clearing review data and its old rejection reason.
- `GET /api/pm/timesheets/pending` now means submitted rows awaiting this PM’s review.
- `PATCH /api/pm/timesheets/:id` accepts `APPROVED` or `REJECTED`; `rejectionReason` is mandatory for rejection.
- `PATCH /api/pm/timesheets/bulk-review` applies an all-or-nothing decision to selected submitted rows.

The OpenAPI record at `openapi.yaml` describes the changed and new endpoints.

## Authorization, transactions, and concurrency

Contractor identity and PM identity always originate from the verified JWT. PM ownership is checked by a project join and mismatches return the existing generic 404 convention. Role mismatches are rejected at the route boundary with 403.

Draft submission locks owned rows in ascending ID order and rejects an incomplete, stale, foreign, inactive, released, or non-active-project selection as one transaction. PM bulk review likewise locks IDs in ascending order; any missing, foreign, or already-reviewed row rolls back the entire batch. Conditional state updates are retained as the final stale-state backstop. Audit records are written in the same transaction.

The original assignment → timesheet reservation safety remains: active assignment locks serialize competing work creation, and the unique contractor/project/date key prevents duplicate daily rows.
