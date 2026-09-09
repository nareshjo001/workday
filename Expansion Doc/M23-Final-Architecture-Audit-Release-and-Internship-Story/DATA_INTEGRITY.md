# Final Data-Integrity Reconciliation

## Financial source of truth

```text
APPROVED timesheet hours
  -> project approved hours
  -> milestone threshold
  -> immutable milestone_billing (hours × assignment bill-rate + currency)
  -> immutable invoice_item
  -> subtotal + derived tax + adjustments = invoice total
  -> append-only payments
  -> paid amount and outstanding amount
```

`DRAFT`, `SUBMITTED`, and `REJECTED` timesheets never contribute to approved work. A milestone contribution is created exactly once. Invoice totals are server-derived; frontend totals are never authoritative.

## Exact M23 fixture

The dedicated test uses INR and proves:

- 8 approved hours × INR 125 snapshot = INR 1,000.00 billing contribution.
- 10% tax = INR 100.00.
- Adjustment = INR 5.25.
- Invoice total = INR 1,105.25.
- Payments INR 305.25 + INR 800.00 = INR 1,105.25.
- Outstanding moves INR 1,105.25 → INR 800.00 → INR 0.00.
- Payment state moves `UNPAID` → `PARTIALLY_PAID` → `PAID`; a further INR 0.01 is rejected.
- PDF bytes contain the same number/currency/total and remain byte-identical after submission.

## Immutability proof

After the financial record exists, the test creates a future rate, corrects later work, releases assignments through project completion, sets the contractor inactive, and changes the legacy contractor default rate. It asserts assignment snapshots, milestone billing, invoice items/totals, PDF storage identity and bytes, and payments remain unchanged.

No foreign-exchange conversion exists. Financial totals are meaningful within an invoice’s single immutable currency; cross-currency portfolio conversion is an intentional limitation, not silently approximated.
