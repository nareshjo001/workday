# M10 — Project Lifecycle & Commercial Controls

M10 gives PMs controlled project edits without weakening existing staffing, timekeeping, billing, or tenant boundaries.

## Delivered

- Project commercial and time-policy fields: budget, currency, daily/weekly limits, weekend permission, and backdate limit.
- Controlled PM updates for project content, dates, capacity, policies, and lifecycle state.
- Requirement editing with OPEN/CLOSED lifecycle, notes, safe headcount reduction, audit records, and no historical deletion.
- Explicit ACTIVE ↔ ON_HOLD and ACTIVE/ON_HOLD → CANCELLED transitions. Completion remains a separate guarded action because it releases active assignments.
- Timesheet enforcement of project-specific date, weekend, backdate, daily, weekly, and lifecycle rules.
- PM settings and staffing-requirements interfaces with actionable server error messages.

## Safety rules

- Expected hours cannot be reduced below active allocations or approved hours.
- Project dates cannot exclude existing assignments or timesheets.
- A project cannot complete with submitted timesheets or invoices awaiting Vendor review. Existing review actions are the explicit resolution path.
- ON_HOLD, CANCELLED, and COMPLETED projects cannot receive new staffing or timesheet submissions.
- Closing a requirement blocks future sourcing but retains all assignments. Requirement counts cannot be reduced below active assignments.

## Verification

`backend/test/integration/m10-project-lifecycle.test.js` covers the lifecycle, policy, requirement, date/capacity, submitted-timesheet, and historical-assignment safeguards. The full backend integration suite and frontend production build pass.
