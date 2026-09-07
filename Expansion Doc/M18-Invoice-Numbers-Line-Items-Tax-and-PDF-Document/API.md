# API

Vendor endpoints:

- `GET /api/vendor/invoices` lists the authenticated Vendor's invoices using
  the established pagination, status, project, and sort parameters.
- `PATCH /api/vendor/invoices/:id` updates permitted DRAFT tax, adjustment,
  invoice-date, due-date, and payment-term metadata.
- `POST /api/vendor/invoices/:id/pdf` regenerates a DRAFT preview document.
- `GET /api/vendor/invoices/:id/pdf` downloads an authorized PDF.

PM endpoint:

- `GET /api/pm/invoices` lists invoices for projects owned by the
  authenticated PM using the same scoped list contract.
- `GET /api/pm/invoices/:id/pdf` downloads a PDF only for a project owned by
  the authenticated PM.

All invoice amounts are server-derived. No endpoint accepts a total, subtotal,
line amount, bill rate, or approved hours as an authoritative invoice value.
