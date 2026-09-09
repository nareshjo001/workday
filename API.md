# VMS API Reference

Base path: `/api`. Protected endpoints use the authenticated access token/session; acting Vendor, PM/company, and Contractor identifiers are never accepted as authority from request payloads. Paginated lists use the M05 `items`, `page`, `page_size`, `total`, and `total_pages` contract. Errors use stable `code`, `message`, optional safe `details`, and `request_id`.

## Shared and authentication

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health`, `/health/live`, `/health/ready` | Safe liveness/readiness |
| POST | `/auth/signup`, `/auth/login`, `/auth/refresh` | Account/session entry and refresh rotation |
| POST | `/auth/logout`, `/auth/logout-all` | Revoke current/all sessions |
| GET | `/auth/me` | Current authenticated account |
| POST | `/auth/forgot-password`, `/auth/reset-password`, `/auth/setup-password` | Recovery and invited-account setup |

Existing-company PM membership requires a verified invitation token. Only the controlled first-company bootstrap creates a new client company.

## Vendor

| Area | Methods and paths |
| --- | --- |
| Contractors | `POST|GET /vendor/contractors`; `PATCH /vendor/contractors/:id`; `POST /vendor/contractors/:id/resend-invitation`; `GET /vendor/contractors/:id/history` |
| Availability | `POST /vendor/contractors/:contractorId/availability` |
| Documents | `POST /vendor/contractor-documents`; `GET /vendor/contractors/:contractorId/documents`; `PATCH /vendor/contractor-documents/:id/review` |
| Clients/projects | `GET /vendor/clients`; `GET /vendor/clients/:companyId`; `GET /vendor/projects`; `GET /vendor/projects/:id/requirements`; `GET /vendor/projects/:projectId/requirements/:requirementId/eligible-contractors` |
| Candidates | `GET /vendor/candidate-submissions`; `GET /vendor/staffing-pipeline`; `POST /vendor/projects/:projectId/requirements/:requirementId/candidates`; `PATCH /vendor/candidate-submissions/:id/withdraw` |
| Rate cards | `GET /vendor/rate-card-skills`; `GET /vendor/clients/:companyId/rate-cards`; `POST /vendor/rate-cards`; `PATCH /vendor/rate-cards/:id` |
| Offboarding | `GET /vendor/projects/:projectId/contractors/:contractorId/release-readiness`; `PATCH /vendor/projects/:projectId/contractors/:contractorId/release` |
| Billing/invoices | `GET /vendor/billing-queue`; `GET /vendor/invoices`; `POST /vendor/invoices/drafts`; `GET /vendor/invoices/:id/detail`; `PATCH /vendor/invoices/:id`; `POST|DELETE /vendor/invoices/:id/items`; `POST /vendor/invoices/:id/submit`; `POST /vendor/invoices/:id/revise`; `POST /vendor/invoices/:id/cancel`; `POST /vendor/invoices/:id/pdf`; `GET /vendor/invoices/:id/pdf` |
| Payments | `POST /vendor/invoices/:id/payments` |
| Dashboard/export | `GET /vendor/dashboard`; `GET /vendor/dashboard/exports/:dataset` |

Candidate submission—not direct assignment—is the active staffing contract. Invoice `PATCH` edits allowed draft metadata; Vendors do not approve their own invoices.

## PM / client

| Area | Methods and paths |
| --- | --- |
| Projects | `POST|GET /pm/projects`; `PATCH /pm/projects/:id`; `PATCH /pm/projects/:projectId/requirements/:requirementId`; `GET /pm/projects/:id/contractors`; `PATCH /pm/projects/:projectId/contractors/:contractorId/allocation` |
| Close/release | `GET /pm/projects/:id/close-readiness`; `PATCH /pm/projects/:id/complete`; `PATCH /pm/projects/:projectId/contractors/:contractorId/release` |
| Vendor access | `GET /pm/vendors`; `GET|POST /pm/vendor-access`; `DELETE /pm/vendor-access/:vendorId`; `POST /pm/projects/:projectId/vendors`; `DELETE /pm/projects/:projectId/vendors/:vendorId` |
| PM invitations | `POST /pm/company/pm-invitations` |
| Candidates | `GET /pm/candidate-submissions`; `GET /pm/staffing-pipeline`; `PATCH /pm/candidate-submissions/:id` |
| Compliance | `GET /pm/contractors/:contractorId/compliance` |
| Timesheets | `GET /pm/timesheets/pending`; `PATCH /pm/timesheets/:id`; `PATCH /pm/timesheets/bulk-review` |
| Milestones | `POST /pm/milestones`; `PATCH /pm/milestones/:id`; `GET /pm/milestones/:projectId` |
| Invoices | `GET /pm/invoices`; `GET /pm/invoices/:id/detail`; `GET /pm/invoices/:id/pdf`; `PATCH /pm/invoices/:id/review` |
| Dashboard/export | `GET /pm/dashboard`; `GET /pm/dashboard/exports/:dataset` |

PM rejection payloads use a required reason when the target status is `REJECTED`. Project completion always rechecks close readiness server-side.

## Contractor

| Area | Methods and paths |
| --- | --- |
| Projects/profile | `GET /contractor/projects`; `GET|PATCH /contractor/profile`; compatibility `PATCH /contractor/profile/skill` |
| Availability | `GET|POST /contractor/availability`; `DELETE /contractor/availability/:id` |
| Timesheets | `POST|GET /contractor/timesheets`; `PATCH /contractor/timesheets/:id`; `POST /contractor/timesheets/submit` |
| Dashboard | `GET /contractor/dashboard` |

Contractor identity is always self-scoped from authentication.

## Notifications (all roles)

Each role prefix exposes `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `GET /notification-preferences`, and `PUT /notification-preferences/:eventType`. Users cannot read or mutate another user’s records.

## Exports

`:dataset` is one of `assignments`, `approved-timesheets`, `invoices`, `invoice-items`, `payments`, or `project-financials`. Server-side filters and tenant scope are shared with dashboard semantics. Spreadsheet-significant leading `=`, `+`, `-`, `*`, and `@` are neutralized.

## Lifecycle and errors

- Candidate: `SUBMITTED -> ACCEPTED | REJECTED | WITHDRAWN`; acceptance is the normal assignment-creation path.
- Timesheet: `DRAFT -> SUBMITTED -> APPROVED | REJECTED`; rejected work may be corrected and resubmitted.
- Invoice: `DRAFT -> SUBMITTED -> APPROVED | REJECTED`, with controlled revision/resubmission and cancellation.
- Payment state is derived separately as `UNPAID`, `PARTIALLY_PAID`, `PAID`, or `OVERDUE`.
- `400` invalid input; `401` missing/invalid/revoked session; `403` wrong role; privacy-safe `404` absent/foreign resource; `409` valid request conflicts with current lifecycle/invariant.

The source route files remain authoritative. `openapi.yaml` is a concise machine-readable subset for core paginated/auth surfaces; this document is the final complete route catalog.
