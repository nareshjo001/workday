# API

`POST /api/vendor/invoices/:id/payments` records settlement for the
authenticated Vendor's approved invoice.

Request fields: `amount` (required positive two-decimal value), optional
`paid_at`, `reference`, `method`, and `notes`. Currency is taken from the
invoice; if supplied, it must match. The response returns the new payment plus
derived `paid_amount`, `outstanding_amount`, `payment_state`, and history.

`GET /api/vendor/invoices/:id/detail` and
`GET /api/pm/invoices/:id/detail` include the same summary/history, scoped to
the authenticated owner. PM endpoints are visibility-only; PMs cannot record
Vendor-received payments.
