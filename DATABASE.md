# VMS Database Model

The application uses MySQL/MariaDB InnoDB tables created by migrations `001` through `016`. The migration runner applies SQL files lexically.

| Table | Purpose | Integrity highlights |
| --- | --- | --- |
| `users` | Shared Vendor, Contractor and PM accounts. | Unique email; role enum. |
| `contractors` | Contractor profile linked to user and vendor. | Unique `user_id`; rate/status/primary skill. |
| `client_companies` / `project_managers` | Canonical PM company and association. | Unique normalized company; one row per PM. |
| `projects` / `project_requirements` | PM projects and staffing demand. | Unique project/skill requirement. |
| `project_assignments` | Contractor/project history. | Unique contractor/project and generated active-contractor key. |
| `timesheets` | Daily contractor/project hours. | Unique contractor/project/work date. |
| `milestones` | Project-level approved-hour thresholds. | Pending/MET lifecycle. |
| `milestone_billings` | Immutable contractor contribution snapshot. | Unique milestone/contractor. |
| `invoices` | Immutable invoice snapshot for billing contribution. | Unique billing ID. |

Key migration history: `005`–`008` introduced skills/requirements; `009`–`010` canonical companies; `013` changed weekly logs to daily rows without inventing detail; `014`–`015` added snapshots/invoices; `016` added expected hours, PM allocation, released assignments, active-only assignment uniqueness, and project-level milestones.
