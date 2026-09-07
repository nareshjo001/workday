# M11 API

All endpoints require the existing JWT and role guard.

## Date-bounded vendor assignment

`POST /api/vendor/projects/:projectId/requirements/:requirementId/assign`

```json
{ "contractorIds": [42], "start_date": "2026-09-07", "end_date": "2026-09-21" }
```

Dates must be real ISO dates, ordered correctly, and within the project range. The API returns `409` when an active assignment or active unavailable period overlaps. Project/vendor access, contractor ownership, active skill, compliance, and requirement capacity are still checked in the same transaction.

## Contractor availability

- `GET /api/contractor/availability`
- `POST /api/contractor/availability`
- `DELETE /api/contractor/availability/:id`
- `POST /api/vendor/contractors/:contractorId/availability` lets the owning Vendor record a contractor's planned unavailable range.

Create body:

```json
{ "start_date": "2026-09-22", "end_date": "2026-09-24", "reason": "Planned leave" }
```

The authenticated contractor is derived from the JWT. Overlapping active unavailable periods return `409`; deletion changes only that contractor's own active record to `CANCELLED`.

## PM individual release

`PATCH /api/pm/projects/:projectId/contractors/:contractorId/release`

```json
{ "actual_end_date": "2026-09-12", "reason": "Engagement completed early" }
```

Only the PM who owns the project may release a currently active assignment. The final date must be inside the project dates. The response retains the assignment as `RELEASED`; it does not delete history.
