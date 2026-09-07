# Audit

Reviewed invoice ownership, queue scope, immutable financial item snapshots, item uniqueness, submitted-review transition locking, post-commit notifications, and audit writes. The M17 canonical review events are `INVOICE_APPROVED` and `INVOICE_REJECTED` (rather than legacy generic `INVOICE_REVIEWED`); each is written inside the review transaction. Cost rates are not included in PM invoice APIs.
