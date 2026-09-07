# Audit

- Financial authority stays in MySQL `DECIMAL`: request totals are never
  accepted, and sum/overpayment checks execute while the invoice is locked.
- Payment state is derived, not a user-editable invoice status. Approval and
  settlement remain distinct.
- `due_date` is compared as an ISO date against the UTC calendar date, making
  the overdue boundary deterministic for the application.
- Vendor ownership is checked in the locked invoice query; PM visibility uses
  existing project ownership and returns the normal hidden not-found result.
- The ledger has no update/delete endpoint. Audit failure rolls back the
  payment mutation, while post-commit notification failure is isolated.
- No payment gateway, refunds, credits, banking reconciliation, or aging
  dashboard is introduced; those remain out of M19/M20 scope as applicable.

Audit outcome: no open M19 implementation finding remains.
