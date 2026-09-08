# Audit

Findings fixed during implementation:

- Contractor legacy revenue and invoice data were removed from the dashboard API and UI.
- Vendor invoice and billable queries now apply an explicit Vendor predicate, preventing shared-project commercial leakage.
- Exports use `EXISTS` scope predicates rather than assignment joins that can duplicate financial rows.
- Currency, totals, and margin derive from immutable financial snapshots; no current rate card is used.

Verification completed: targeted M20 integration coverage, full backend coverage regression, frontend lint, and production build. No M20 audit finding remains open.
