# Implementation

Migration `034_payments.sql` adds an append-only `payments` ledger with an
invoice/date index, payment currency, safe reference/method/notes fields, and
the user who recorded it. Invoice totals are never changed by a payment.

Only the owning Vendor can record a payment, and only when the invoice is
`APPROVED`. The service locks the invoice row with `FOR UPDATE`, obtains the
existing payment total, and asks MySQL `DECIMAL` arithmetic whether the new
amount fits within the immutable invoice total before inserting. This prevents
concurrent overpayment without relying on an application-only pre-check.

`paid_amount` is `SUM(payments.amount)` and `outstanding_amount` is invoice
total minus that sum, calculated in SQL. `UNPAID`, `PARTIALLY_PAID`, and
`PAID` follow the exact zero/intermediate/exact-payoff values. `OVERDUE` means
an outstanding balance and `due_date <` the current UTC calendar date. A paid
invoice is never overdue.

Vendor and authorized PM invoice details/listing include the payment summary
and immutable history. Payment audit writes occur in the same transaction as
the insert; an audit failure rolls back the new payment. M14 payment-recorded
and fully-paid notices are attempted after commit for the owning PM and may be
disabled through normal preferences; notification failure cannot alter the
payment result.

When a user opens the existing notification inbox, M14 also materializes
payment alerts for outstanding approved invoices: due-soon covers today through
three UTC calendar days ahead, and overdue covers any earlier due date. The
notification uniqueness key makes repeated inbox checks idempotent. This is a
small deterministic pull trigger, not a new worker or delivery channel.
