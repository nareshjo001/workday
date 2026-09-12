# M32 — Audit Trail Experience

## Objective

M32 exposes existing business audit history as a read-only, role-safe Activity experience. It answers what happened, who did it, when it occurred, and the affected business entity without returning raw audit rows or payloads.

## Reused audit architecture

M32 reuses `audit_log`, `auditRepository.append`, and `auditService.write`. No audit table, event-sourcing mechanism, migration, or new audit write event was introduced. Activity reads never write audit rows, notifications, or business state.

## Endpoints and role scope

- `GET /api/pm/projects/:projectId/activity?page=&limit=`: PM-only; verifies project ownership and returns activity for that project’s project, requirements, candidates, assignments, timesheets, invoices, payments, and milestones.
- `GET /api/vendor/activity?page=&limit=`: Vendor-only; returns activity connected to the Vendor’s contractors, candidates, assignments, timesheets, contractor documents, invoices, payments, and rate cards.
- `GET /api/contractor/activity?page=&limit=`: Contractor-only; returns only that contractor’s profile, availability, candidate, assignment, document, and timesheet activity. It excludes invoices and commercial activity.

Authorization derives only from the authenticated JWT. The API accepts no role, actor, vendor, contractor, PM, or client override. Unauthorized PM project probes return the existing 404 shape.

## Safe projection

The API returns `items` and `pagination`, not raw `audit_log` rows. Each item contains an event mapping, actor display name/role, timestamp, entity type/id, a concise deterministic summary, and allowlisted details only.

Known events use readable mappings such as Timesheet submitted, Candidate accepted, Assignment created, Invoice submitted, and Project completed. Unknown authorized legacy events degrade to **Business activity recorded** with no metadata disclosure.

Only these safe detail fields can appear when present: status transitions, work date, hours, document type/expiry, assignment dates/allocation, released-assignment count, and invoice number. Sensitive metadata—including passwords, tokens, OTPs, cost rates, cost snapshots, margins, rate-intelligence data, request data, and internal errors—is never projected.

## UI integration

- PM Projects now includes a project-level **Activity** action, kept separate from Project Control. It loads the selected project’s history with refresh and pagination.
- Vendor and Contractor workspaces include a compact Activity page scoped by their authenticated identity.
- The list uses semantic headings, readable actor/role/timestamps, native refresh/pagination buttons, loading status, alert errors, and responsive wrapping cards.

## Sorting and pagination

Results are deterministic: `created_at DESC, id DESC`. Pagination uses `page` and `limit`, defaults to 25, and caps the page size at 50.

## Tests and verification

Focused backend test: `backend/test/integration/m32-audit-trail.test.js` verifies authentication, PM ownership/404 behavior, server-side vendor/contractor scope, deterministic ordering, safe metadata filtering, pagination shape, and read-only audit count.

Focused frontend tests cover service parsing/closed failure and list loading/error/empty/safe-detail rendering.

## Limitations and boundary

M32 intentionally does not create missing historic context, recursively diff arbitrary JSON, reveal security/auth events, or provide an administrative audit console. It does not add AI, predictions, workflow actions, exports, notifications, or M33 work.
