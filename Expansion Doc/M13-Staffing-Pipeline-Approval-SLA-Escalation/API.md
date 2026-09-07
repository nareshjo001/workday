# M13 API

`PATCH /api/pm/projects/:id` accepts `candidate_response_sla_hours`, a required-positive integer when supplied, capped at 8,760. Existing projects receive the 48-hour default through migration 028.

`GET /api/pm/staffing-pipeline` returns requirement-level funnel counts for projects owned by the authenticated PM.

`GET /api/vendor/staffing-pipeline` returns requirement-level funnel counts for the authenticated Vendor's active project relationships.

Both read APIs accept optional `client_id`, `project_id`, `skill`, `status`, and `sla_breached=true|false` filters. Each item includes required and assigned counts, open positions, submitted/shortlisted/accepted/rejected/withdrawn counts, the oldest unresolved submission, derived `due_at`, and `sla_breached`.

The PM route is role-protected and ownership-scoped. The Vendor route is role-protected, relationship-scoped, and does not disclose other vendors' submission funnel data.
