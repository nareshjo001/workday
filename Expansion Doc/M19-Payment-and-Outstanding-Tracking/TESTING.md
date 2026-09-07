# Testing

`backend/test/integration/m19-payment-tracking.test.js` runs the real M17/M18
invoice workflow then verifies M19 through the API and service boundary:

- DRAFT, SUBMITTED, REJECTED, and CANCELLED invoices reject payments.
- Approved invoices support partial payment, exact payoff, preserved history,
  zero/negative validation, and cross-tenant hiding.
- Two simultaneous final-payoff requests yield exactly one success and one
  overpayment conflict.
- An overdue invoice is derived from a past due date; full payment clears it.
- Audit data identifies the payment, invoice, actor, request, and safe
  reference. A forced audit failure leaves the payment count unchanged.
- A forced post-commit notification failure still returns the committed
  payment result.

The full backend coverage suite, frontend tests, lint, and production build
are run before completion.
