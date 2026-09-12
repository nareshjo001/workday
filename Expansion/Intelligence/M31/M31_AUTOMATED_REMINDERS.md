# M31 — Automated Reminders

## Objective

M31 adds a small, deterministic, independently runnable in-app reminder job. It observes trusted VMS state, creates only eligible notifications through the existing M14 notification system, and never changes workflow or financial records.

## Existing infrastructure reused

M31 uses `notifications`, `notification_preferences`, `notificationService`, the existing role notification pages, the existing audit log, and M03 structured logging. Notification rows retain the established `deep_link` contract; the existing Notifications page marks a row read and follows only a link within the logged-in role's route scope. Migration `038_notification_lifecycle_dedupe.sql` adds an internal, non-null `lifecycle_key` and expands the notification uniqueness constraint to:

`recipient_id + event_type + entity_type + entity_id + lifecycle_key`

This keeps creation atomic under overlapping job runs while allowing a genuinely resubmitted timesheet or invoice to create a new review notification. No reminder table, queue, external mail/SMS sender, second audit system, or frontend redesign was added.

## Implemented reminders

| Reminder | Authoritative current state | Recipient | Destination |
| --- | --- | --- | --- |
| PM timesheet review | `timesheets.status = SUBMITTED` | owning project PM | `/pm/timesheets` |
| PM candidate review | `candidate_submissions.status = SUBMITTED` | owning project PM | `/pm/staffing-pipeline` |
| PM invoice review | `invoices.status = SUBMITTED` | owning project PM | `/pm/invoices` |
| Vendor document expiry | `VERIFIED` document expiring within 30 days | owning Vendor | `/vendor/compliance` |

The 30-day document window is the existing M08/M27 compliance window. Pending review reminders deliberately use the existence of the current pending entity; no new business SLA age was invented. Reminder content is concise and contains no Vendor cost, margin, rate-intelligence data, or predictive language.

## Skipped reminder

M31 does not add a separate contractor rejected-timesheet reminder. The existing PM review workflow already sends the Contractor an actionable `TIMESHEET_REJECTED` notification linked to `/contractor/timesheets`, where a rejected entry can be edited and resubmitted. A scheduled duplicate would be noisy rather than useful.

## Eligibility, preferences, resolution, and dedupe

The repository queries only current statuses. Approved/rejected timesheets and invoices, and accepted/rejected/withdrawn candidates, are not eligible. Rejected or long-valid documents are not eligible. Historical notifications are retained after resolution, but resolved items cannot receive a new notification because they no longer appear in the eligibility query.

Before an insert, the reminder service checks the existing recipient preference for the matching notification event type. Preferences are recipient-scoped. `INSERT IGNORE` against the expanded unique key remains the final race-safe boundary, including concurrent runner executions.

Timesheet and invoice review reminders are lifecycle-aware. Each authenticated transition into `SUBMITTED` creates an existing `TIMESHEET_SUBMITTED` or `INVOICE_SUBMITTED` audit row; its monotonic `audit_log.id` becomes `submission:<audit-id>`. The synchronous workflow notification and scheduled runner use the same helper and key, so they deduplicate against one another. Rejection followed by correction/revision and resubmission creates a new audit ID and therefore one new notification without deleting the earlier history row. Read state on the earlier notification does not affect the later lifecycle.

Seeded or legacy submitted rows without a matching submission audit use `submitted_at:<persisted-server-timestamp>`. This fallback is stable across scheduler runs but retains the source column's second-level precision limitation. Candidate and document reminders use the default empty lifecycle key and therefore retain permanent entity-level deduplication.

Migration backfill associates an existing timesheet/invoice submission notification only with the latest matching audit event whose creation time is not later than that notification. Unresolvable legacy history keeps the empty key; no audit records or notification history are manufactured or deleted.

## Runner and scheduling

Run locally:

```text
cd D:\Projects\WorkDay\backend
npm run reminders:run
```

The runner calls `reminderService.runDueReminders()` and logs safe start/finish summaries containing evaluated, created, deduplicated, preference-skipped, and error counts. It also invokes the existing M19 payment-alert materialization so notification list reads remain observational; those existing alert outcomes are included in the same operational summary.

Production deployment should invoke this command with the hosting platform's scheduled-job mechanism (for example, hourly). M31 does not configure hosting infrastructure or run work during login, dashboard access, or notification-list requests.

## Security and business-state boundary

Recipients derive only from server-side project and contractor relationships. The job receives no client-supplied recipient, role, tenant, or business IDs. Its only permitted mutation is notification insertion. It does not modify projects, candidates, assignments, timesheets, documents, invoices, payments, milestones, audit logs, or workflow state. Notification checks and creation do not create business audit events, consistent with M14.

## Files

- `backend/src/repositories/reminderRepository.js`
- `backend/src/repositories/auditRepository.js`
- `backend/src/repositories/notificationRepository.js`
- `backend/src/services/reminderService.js`
- `backend/src/services/contractorTimesheetService.js`
- `backend/src/services/invoiceLifecycleService.js`
- `backend/src/utils/notificationLifecycle.js`
- `backend/src/migrations/038_notification_lifecycle_dedupe.sql`
- `backend/scripts/runReminders.js`
- `backend/src/services/notificationService.js`
- `backend/src/controllers/notificationController.js`
- `backend/package.json`
- `backend/test/integration/m31-automated-reminders.test.js`
- `frontend/src/pages/NotificationsPage.jsx`
- `frontend/src/pages/NotificationsPage.test.jsx`

## Tests

The focused M31 integration suite verifies the migration shape, empty-key compatibility, submitted and terminal-state handling, PM/project isolation, destinations, recipient preferences, repeated and concurrent dedupe, timesheet and invoice resubmission, synchronous/scheduled consistency, legacy timestamp fallback, vendor-only expiring-document reminders, no separate rejected-timesheet reminder, and business/audit non-mutation. The focused notification-page test verifies that a role-scoped reminder is marked read and opens its established workflow link, while a cross-role link is not followed.

The lifecycle-aware focused suite passes 8/8, including inside full and instrumented runs. The current ordinary backend and coverage runs each complete 53/55 tests: two existing M29 assertions use Node's UTC `day(0)` while their SQL fixtures use database-local `CURDATE()`, which refer to different dates after local midnight. Those failures are outside M31; M31 remains green, coverage percentages exceed every configured threshold, and no gate was weakened.

## Demo scenarios

After the demo database is seeded, run the command above and inspect the existing Notifications pages:

- `demo.pm@workday.local`: Atlas Commerce Modernization contains current submitted candidate/timesheet attention data; the corresponding reminder opens the existing PM review workflow.
- `demo.vendor@workday.local`: the verified `atlasfrontend` document expires on 2026-09-25 and produces a Vendor compliance reminder.

These describe current seed data and are not hardcoded product assumptions.

## Limitations and non-goals

M31 still does not re-remind an unchanged pending lifecycle after an arbitrary interval. Candidate and document reminders remain permanently deduplicated per entity because their current workflows do not re-enter an independent submitted/expiry lifecycle on the same row. Historical notifications that cannot be safely associated with an audit event remain legacy rows with an empty key. The `submitted_at` fallback for unaudited seed/legacy submissions has second-level precision and is intentionally not used as the authoritative production lifecycle identifier.

M31 intentionally does not add a cooldown schema or generic reminder framework. It does not add external delivery, automatic decisions, reminders based on prediction, an audit UI, or any M32+ functionality.
