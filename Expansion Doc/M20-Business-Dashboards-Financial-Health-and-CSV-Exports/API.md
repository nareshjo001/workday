# API

Authenticated Vendor and PM dashboard endpoints retain their existing `GET /api/vendor/dashboard` and `GET /api/pm/dashboard` contracts and add an `m20` analytics object.

`GET /api/{vendor|pm}/dashboard/exports/{dataset}` returns `text/csv` with an attachment filename. Supported datasets are `assignments`, `approved-timesheets`, `invoices`, `invoice-items`, `payments`, and `project-financials`.

Optional query parameters are `clientId`, `projectId`, `skillId`, `status`, `startDate`, and `endDate`. IDs must be positive integers and dates must be `YYYY-MM-DD`. Role and tenant scope is derived exclusively from the authenticated session.
