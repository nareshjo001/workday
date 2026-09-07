# M10 API

All endpoints require an authenticated PM and are scoped to the PM's own projects.

## Update a project

`PATCH /api/pm/projects/:id`

Supported fields are `name`, `description`, `start_date`, `end_date`, `expected_hours`, `budget`, `currency`, `max_hours_per_day`, `max_hours_per_week`, `allow_weekend`, `backdate_limit_days`, and `status`.

The endpoint validates data shape and preserves existing records. `COMPLETED` is intentionally rejected here: use the completion endpoint so assignment release and completion occur atomically.

## Complete a project

`PATCH /api/pm/projects/:id/complete`

Only ACTIVE and ON_HOLD projects can complete. Submitted timesheets and `PENDING_REVIEW` invoices must be resolved first. Completion transitions the project to COMPLETED and releases active assignments while retaining assignment, timesheet, milestone, and billing history.

## Update a requirement

`PATCH /api/pm/projects/:projectId/requirements/:requirementId`

Supported fields are `required_count`, `description`, and `status` (`OPEN` or `CLOSED`). A CLOSED requirement cannot receive new Vendor assignments. Existing assignments are not deleted.
