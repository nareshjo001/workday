# Audit

## Reviewed

Authorization and role validation, tenancy scoping, invitation-token handling, normalized company-name bootstrap races, 404 behavior, relationship revocation, historical data retention, transaction/audit atomicity, SQL parameterization/indexes, and frontend/backend contracts.

## Findings and fixes

- HIGH — Existing-company PM self-claim was possible. Fixed with invitation-only membership and duplicate-safe bootstrap creation.
- HIGH — PM could grant a project while connecting without checking project ownership. Fixed before the transaction.
- MEDIUM — PM UI exposed raw internal IDs. Replaced with registered-Vendor and owned-project selectors.
- MEDIUM — Vendor lacked a client-management experience. Added scoped directory and detail API/UI.
- MEDIUM — Relationship removal was missing. Added audited revocation that prevents future sourcing without deleting historical assignments.

No unresolved M09 findings remain. CRM and payment features were not added; they are explicitly outside M09 and are not represented as available data.
