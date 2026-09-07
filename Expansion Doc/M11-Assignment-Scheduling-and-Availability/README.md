# M11 — Assignment Scheduling and Availability

## Delivered scope

M11 adds date-bounded staffing without losing assignment history.

- Assignments store planned `start_date` and optional `end_date`, plus an `actual_end_date` and required release reason when a PM ends an engagement early.
- Existing assignment rows are backfilled from `assigned_date` during migration `026_assignment_dates_and_availability.sql`.
- The former generated one-active-assignment key is removed. A contractor may now have multiple active assignments only when their staffed date ranges do not overlap.
- Assignment creation locks the contractor and overlapping active assignment rows in the same transaction as project and requirement capacity checks. It rejects overlapping dates and availability conflicts with stable `409` domain errors.
- Contractors can create, list, and cancel their own unavailable periods; the owning Vendor can also record a planned range for its contractor. They cannot manage another Vendor's contractor.
- Vendors choose assignment dates in the staffing picker. The eligible directory is scoped to the project period and excludes overlapping active assignments and unavailable contractors; the server remains the authoritative race-safe enforcement point.
- A PM can release an individual contractor with an actual last date and reason. The assignment remains visible in historical project and contractor views.

M11 does not add CRM or commercial payment features.

## Migration

Run the normal backend migration process. Migration 026 is intentionally ordered after the earlier assignment-status migration and is safe for historical rows because it first copies `assigned_date` into `start_date`.

## API summary

- `POST /api/vendor/projects/:projectId/requirements/:requirementId/assign` accepts optional `start_date` and `end_date` with `contractorIds`.
- `GET|POST|DELETE /api/contractor/availability[/:id]` manages the authenticated contractor's unavailable periods.
- `PATCH /api/pm/projects/:projectId/contractors/:contractorId/release` accepts `actual_end_date` and `reason` and is limited to the owning PM.

See [API.md](API.md), [TESTING.md](TESTING.md), and [AUDIT.md](AUDIT.md).
