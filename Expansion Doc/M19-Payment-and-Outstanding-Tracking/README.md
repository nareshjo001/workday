# M19 — Payment & Outstanding Tracking

M19 records settlement after an invoice has been approved. Invoice lifecycle
status remains `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, or `CANCELLED`;
payment state is separately derived as `UNPAID`, `PARTIALLY_PAID`, `PAID`, or
`OVERDUE`.

This is a settlement ledger, not a payment gateway or banking integration.
