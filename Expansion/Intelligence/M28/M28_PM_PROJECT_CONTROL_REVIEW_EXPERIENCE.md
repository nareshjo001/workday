# M28 — PM Project Control Review Experience

## Objective and integration

M28 adds a feature-gated **Project Control** action to the existing PM Projects screen. Selecting a PM-owned project opens a project-level read-only panel beneath the existing list; it does not create a new navigation area or workflow.

## M27 dependency and capability

The UI first uses M24 capability discovery. It renders no Project Control action and makes no M27 request unless `pm_project_control` is `true`. When selected or refreshed, it calls only `GET /api/pm/projects/:id/control-intelligence`; the JWT-bearing API client remains the authorization boundary.

The response validator requires the M27/M24 contract version, project context, authoritative summary counts, safe finding evidence, and source `pm_project_control` version `1`. Inconsistent or malformed payloads fail closed as a non-blocking error.

## Review experience

The panel renders M27's returned order unchanged. It shows factual attention counts, severity text, title, summary, labelled primitive evidence, and advisory recommended action. It does not calculate counts, severity, staffing, close-readiness, financial values, or any other business value.

Supported workflow links use existing PM routes: timesheets, staffing pipeline, invoices, and project team management. `OPEN_REQUIREMENTS_REMAIN` reuses the selected project's existing Requirements modal. `PROJECT_NOT_READY_TO_CLOSE` deliberately has no button because the existing completion control is an immediate confirm-and-complete action rather than a reusable read-only readiness view. `CONTRACTOR_DOCUMENT_EXPIRING` also remains advisory because there is no PM-authorized document-review page. Findings without a known existing destination remain readable without an action button.

Loading, empty, error/retry, manual refresh, and project changes are handled without blocking the normal Projects workflow. A new selection clears the prior response before the new request begins.

## Accessibility, responsiveness, and audit boundary

Severity is explicit text; buttons and links are native keyboard controls; loading uses a status role and errors an alert role. Summary cards and evidence grids stack on small screens with wrapping text. Viewing, refreshing, and navigation create no audit or notification event.

## Security and non-goals

The UI sends only the selected project ID in the path—never a PM, role, Vendor, cost, margin, or intelligence input. No Vendor-private cost/margin data is rendered. M28 adds no AI, persistence, notifications, approvals, automatic remediation, new M27 rule, migration, or M29+ functionality.

## Tests and manual check

Focused tests cover payload validation, server-authoritative summary rendering, evidence, mapped/unsupported actions, loading, empty, and error states. The existing M27 demo check is: sign in as `demo.pm@workday.local`, open **Projects**, choose **Atlas Commerce Modernization**, then select **Project Control**. With the flag enabled, the current demo response shows six findings in M27 order. For an empty/error check, use a PM project with no attention items or temporarily make the endpoint unavailable; the Projects workflow remains usable and offers retry.

The final focused tests also cover capability-disabled absence/no request, stale-project clearing, manual refresh, the Requirements callback, and the rejected-timesheet advisory-only regression. `TIMESHEETS_AWAITING_REVIEW` is the only timesheet finding linked to `/pm/timesheets`; `REJECTED_TIMESHEETS_EXIST` has no PM review destination and deliberately has no button. A one-off full-suite run saw timeouts in the unrelated Vendor dashboard tests, but `VendorHomePage.test.jsx` and `VendorDashboardFilters.test.jsx` both passed directly in isolation.

## Limitations

The panel intentionally links only to routes already present in the PM workspace. Contractor-document findings currently remain advisory text because there is no existing PM document-review page. M29 and later modules are out of scope.
