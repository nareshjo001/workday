# VMS API Reference

Base path: `/api`. Protected endpoints require `Authorization: Bearer <JWT>`.

| Area | Endpoints |
| --- | --- |
| Shared | `GET /health`, `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` |
| Vendor | contractors CRUD subset; project browse/detail/eligible/atomic assign; invoice list/review; dashboard under `/vendor` |
| Contractor | projects, profile/skill, daily timesheet create/list/edit, dashboard under `/contractor` |
| PM | project create/list/team/complete/allocation, pending timesheet list/review, milestones, read-only invoices, dashboard under `/pm` |

Important payloads: assignment accepts `{ contractorIds }`; PM allocation accepts `{ allocated_hours }`; daily timesheet submission accepts `{ projectId, workDate, hoursLogged }`; milestone creation accepts `{ project_id, name, threshold_hours }`; review endpoints accept a restricted `{ status }` plus an invoice rejection reason when rejecting.

Errors: `400` invalid input, `401` invalid/missing session, `403` wrong role, `404` absent or protected foreign resource, and `409` current-state conflict. Current errors use `message` and optional validation `errors`; stable error codes are M03 work.
