# M27 — PM Project Control & Attention Engine

## Objective

M27 adds a PM-only, deterministic, read-only attention endpoint:

`GET /api/pm/projects/:id/control-intelligence`

It answers what needs current PM attention on one authorized project. It returns M24 structured findings, not a project-health score, prediction, model confidence, or workflow decision.

## Architecture and security

The endpoint is inside the existing PM JWT/RBAC router. The route parameter is validated, the project is looked up using the authenticated `req.user.userId`, and another PM's project returns the established not-found response. No actor, vendor, client, cost, margin, or rate input is accepted. The feature uses `INTELLIGENCE_PM_PROJECT_CONTROL_ENABLED`; it is disabled by default and returns the established unavailable/not-found behaviour when disabled.

The response contains only safe project context, deterministic counts/dates, and M24 findings with source `{ engine: "pm_project_control", version: "1" }`. It never returns Vendor rate-card costs, margins, or Vendor Rate Intelligence data.

## Rules implemented

- submitted timesheets awaiting PM review (INFO)
- factual rejected-timesheet history (INFO; does not claim unresolved correction)
- open requirements/remaining staffing slots (INFO)
- candidate submissions awaiting PM decision (INFO)
- active assignments ending within 14 days (MEDIUM) or past their end date (HIGH)
- verified assigned-contractor documents expiring within 30 days (MEDIUM)
- submitted invoices awaiting PM review, grouped by currency (INFO)
- existing project-close blockers, reusing `pmProjectService.getCloseReadiness` (HIGH)

The assignment threshold is the single named M27 rule window of 14 days. Document expiry uses the existing generic verified-document expiry semantics and only makes a factual expiry claim. The engine avoids unsupported prediction, arbitrary time norms, exact invoice reconciliation, and overdue-payment totals; those are intentionally deferred unless a future module has a dedicated, immutable reconciliation contract.

## Read-only and performance

The endpoint uses grouped project-scoped aggregates and one bounded assignment-detail query. It does not mutate project, candidate, assignment, timesheet, invoice, payment, document, notification, or audit state, and it creates no persistence or migration. Findings are sorted deterministically by severity then code.

## Test-fixture correction and verification

The M27 integration fixture creates its project through the existing PM project API. The current project-create contract requires a positive `expected_hours` value in addition to the project name, valid start date, and requirements; the fixture now supplies deterministic `expected_hours: 40` and asserts the `201` response before reading the created project. This preserves project validation rather than inserting an invalid project row directly.

The isolated M27 integration test passed twice consecutively after the correction. The ordinary backend integration suite (`npm test`) also passed with 20 passing files and no failures. The coverage command was attempted, but failed during unrelated integration-suite database-reset collisions under coverage instrumentation; no coverage threshold or production behavior was changed to mask that failure.

The current dedicated M27 test is a focused nine-case integration matrix covering RBAC, feature gating, project scoping, rule boundaries, contract validity, deterministic ordering, privacy, and read-only behavior.

The expanded focused suite now contains nine integration cases and passed twice consecutively. It verifies project-scoped submitted/rejected timesheets, remaining-capacity requirements, submitted candidates, active assignment date boundaries, assigned-contractor document expiry, submitted invoice totals, close-readiness reuse, an empty clean project, deterministic severity/code ordering, response privacy, and read-only/audit/notification non-mutation. The suite found and corrected one rule defect: fully staffed requirements were being included in the open-requirement count. The aggregate now counts only requirements whose active assignment count is below the required count.

## Live demo closeout

On the local `vms_demo` database with the PM Project Control feature enabled, an authenticated request as `demo.pm@workday.local` returned a `200` response for project `2`, **Atlas Commerce Modernization** (`ACTIVE`). Its live summary was `attention_count: 6` with `{ HIGH: 1, MEDIUM: 1, LOW: 0, INFO: 4 }`. The returned codes, in order, were `PROJECT_NOT_READY_TO_CLOSE`, `CONTRACTOR_DOCUMENT_EXPIRING`, `CANDIDATE_REVIEWS_PENDING`, `OPEN_REQUIREMENTS_REMAIN`, `REJECTED_TIMESHEETS_EXIST`, and `TIMESHEETS_AWAITING_REVIEW`.

The live response contained no Vendor-private cost or margin fields and the read-only before/after check found no changes to project, candidate, timesheet, invoice, audit-log, or notification records.

## Non-goals

No PM UI, M28 navigation, external AI, LLM, chatbot, reminders, automatic approval/rejection, automatic project closure, rate intelligence, or M29+ functionality is included.
