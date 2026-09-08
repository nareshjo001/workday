# Implementation

`project_assignments` now retains `planned_last_working_date`, `actual_end_date`, `release_reason`, `released_by`, and `released_at`. Existing rows receive their scheduled end date as the planned last-working date.

PM completion locks the project, recomputes readiness in the transaction, marks it completed, releases active assignments with the acting PM, and writes both project and per-assignment audit records before commit. A failed audit rolls back the business mutation.

Vendors can preflight and release only their own contractor on an actively authorized project. The same service rechecks assignment state and submitted-timesheet blockers inside its transaction. Contractor notification is post-commit and cannot reverse a release.

Vendor contractor history is scoped through the contractor's vendor ownership and includes assignment dates/reason, approved hours, immutable rate snapshots, milestone billing, and payment facts. PM views intentionally expose no Vendor cost-rate or margin information.
