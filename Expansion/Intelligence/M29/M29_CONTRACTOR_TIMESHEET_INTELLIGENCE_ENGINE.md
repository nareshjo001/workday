# M29 — Contractor Timesheet Intelligence Engine

M29 adds the deterministic, read-only Contractor-only endpoint `POST /api/contractor/timesheet-intelligence/analyze`. It accepts the existing timesheet form shape—`projectId`, `workDate`, `hoursLogged`, and optional `description`—and derives contractor identity exclusively from JWT.

## Reused authoritative rules

| Rule | Existing source | M29 treatment |
| --- | --- | --- |
| Input/date/hour shape | `contractorTimesheetValidators` | Reused directly |
| Future/project date window | `contractorTimesheetService` | Deterministic pre-submit finding |
| Active assignment/project | submission service | Deterministic pre-submit finding |
| Duplicate project/day entry | unique constraint and submission service | Deterministic pre-submit finding, including a rejected row that must be edited rather than recreated |
| Project daily maximum | project time policy | Deterministic pre-submit finding |

M29 returns M24 findings with source `contractor_timesheet_intelligence` / `1`. It has no writes, audit events, notifications, submission coupling, AI, migration, or frontend/UI work.

The feature uses the existing `INTELLIGENCE_CONTRACTOR_TIMESHEET_ENABLED` flag. When disabled, the endpoint is unavailable. Contractor router JWT/RBAC and a contractor-scoped assignment query enforce ownership. The accepted proposal fields are `projectId`, `workDate`, `hoursLogged`, and optional `description`; contractor identity, assignment/project state, date policy, and policy values are server-derived.

Implemented findings are `ASSIGNMENT_NOT_ACTIVE_FOR_WORK`, `PROJECT_NOT_OPEN_FOR_TIMESHEETS`, `TIMESHEET_FUTURE_DATE`, `TIMESHEET_OUTSIDE_PROJECT_WINDOW`, `DUPLICATE_TIMESHEET_ENTRY`, and `DAILY_HOURS_EXCEED_POLICY`, all HIGH because they surface existing hard submission constraints. Duplicate detection includes rejected records because the current unique key still reserves the contractor/project/date combination; rejected hours are deliberately excluded from the active daily-hours policy calculation, matching the submission service. The daily-policy evidence exposes existing hours, proposed hours, resulting daily hours, and the configured project limit. Weekend, backdate, weekly-policy, allocation-capacity, assignment-date, and description validation remain enforced by the submission workflow but are intentionally not separately surfaced as M29 findings. M30 owns all Contractor UI.

## Verification

`backend/test/integration/m29-contractor-timesheet-intelligence.test.js` verifies feature gating, JWT/RBAC, contractor ownership, request validation, capability discovery, all implemented finding paths, rejected-entry semantics, M24 source/evidence safety, commercial-field exclusion, and read-only analysis. The suite is intentionally backend-only; M30 remains the Contractor UI boundary.

Focused execution passed twice consecutively (4 tests each run). Following the shared test-reset serialization correction, the full backend suite passes 47/47 (exit code 0) and coverage passes with lines 85.02%, functions 79.17%, and branches 73.04%.

## Manual demo check

On 2026-09-11, `demo.contractor@workday.local` against project `1` (`Demo Platform Upgrade`, `ACTIVE`) returned HTTP 200 for a one-hour same-day analysis with `finding_count: 0` and no findings. This is a live demonstration result, not a permanent seed-data guarantee.

Using the same Contractor/project/hour context with `workDate: "2026-09-12"` returned HTTP 200 with one `HIGH` `TIMESHEET_FUTURE_DATE` finding. Its evidence identified that date and advised choosing a non-future date. Before/after comparison confirmed no timesheet mutation and unchanged audit-log (10) and notification (15) counts.
