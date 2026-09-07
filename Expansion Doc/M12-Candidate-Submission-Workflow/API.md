# M12 API

- `POST /api/vendor/projects/:projectId/requirements/:requirementId/candidates`
- `GET /api/vendor/candidate-submissions`
- `PATCH /api/vendor/candidate-submissions/:id/withdraw`
- `GET /api/pm/candidate-submissions`
- `PATCH /api/pm/candidate-submissions/:id` with `SHORTLISTED`, `ACCEPTED`, or `REJECTED` (rejection requires `reason`).

Acceptance is transactionally revalidated and is the only path that inserts `project_assignments`.
