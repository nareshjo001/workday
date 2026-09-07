# API

- `POST /api/pm/milestones` accepts `description`, `sequence_order`, and `due_date` in addition to the established milestone fields.
- `PATCH /api/pm/milestones/:id` updates a PENDING milestone only.
- `GET /api/pm/milestones/:projectId` returns ordered timeline metadata and contribution breakdowns.
