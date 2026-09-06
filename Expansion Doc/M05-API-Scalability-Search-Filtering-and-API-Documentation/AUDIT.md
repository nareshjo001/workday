# Audit

Final status: no open Critical, High, Medium, or Low M05 findings.

Fixed findings:

- MEDIUM: optional pagination left unbounded no-query responses. Fixed by making the envelope default and updating callers/regression scripts.
- MEDIUM: omitted default sort was resolved as a SQL field rather than an allow-list key. Fixed in `parseListQuery`.
- MEDIUM: first index migration was not repeat-safe on the supported MySQL version. Fixed with information-schema guarded statements.
- LOW: PM invoice filter validation differed from the Vendor route. Fixed with shared enum/positive-integer normalizers.
- LOW: the milestone project picker still treated a project envelope as an array. Fixed to use `items`.

JWT identities remain server-derived. Tenant predicates occur in repository SQL before pagination. Sort fields are allow-listed and filter values parameterized. M05 is read-path work: it does not remove or reorder transactions, `FOR UPDATE`, uniqueness, or immutable financial snapshots. Primary-key tie breaking prevents ambiguous page order.

Deferred outside M05: the historical migration runner replays all migrations and older migration 017 is not repeat-safe. M05's migration itself is guarded and clean-database setup succeeds. A global migration ledger belongs to a dedicated migration-operability module.
