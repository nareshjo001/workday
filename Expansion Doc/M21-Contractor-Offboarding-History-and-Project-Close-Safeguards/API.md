# API

All endpoints use the authenticated session identity; IDs in request bodies never select an actor.

- `GET /api/pm/projects/:id/close-readiness` returns `{ can_complete, blockers, warnings }` for an owned project.
- `PATCH /api/pm/projects/:id/complete` rechecks the same readiness policy transactionally and returns `409 PROJECT_CLOSE_BLOCKED` when blockers exist.
- `GET /api/vendor/contractors/:id/history` returns the calling Vendor's contractor assignment history.
- `GET /api/vendor/projects/:projectId/contractors/:contractorId/release-readiness` returns `{ can_release, blockers, warnings }`.
- `PATCH /api/vendor/projects/:projectId/contractors/:contractorId/release` accepts `actual_end_date` and a required `reason`; it returns `409 ASSIGNMENT_RELEASE_BLOCKED` for unresolved submitted timesheets.

Unknown, unrelated, revoked, or cross-tenant resources use the established not-found behavior.
