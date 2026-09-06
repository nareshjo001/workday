# Implementation

Frontend list state → API client query parameters → authenticated role route → `parseListQuery` → controller allow-list/normalizers → service envelope → repository SQL ownership predicate, filters, stable order, `LIMIT/OFFSET` → `{items,page,page_size,total,total_pages}`.

`backend/src/utils/listQuery.js` defaults to page 1 and 25 rows, caps page size at 100, allow-lists sort columns, validates direction and typed filters, and calculates the SQL offset. Repositories never interpolate client input except a controller-approved SQL column; filter values remain parameterized.

Implemented endpoints: Vendor contractors (`search`, `skill`, `status`); PM projects (`search`, `status`, `startDate`); staffing-available vendor projects (`search`, `startDate`); contractor timesheets (`projectId`, `status`, `startDate`); PM pending timesheets (`projectId`, `startDate`, `search`); and Vendor/PM invoices (`projectId`, `status`). Ownership is always in repository SQL before pagination.

Every query appends a primary-key tie breaker to its selected sort. Existing mutation transactions, locks, financial calculations, and row ownership semantics were not changed.

Migration 019 adds composite indexes for contractor vendor/status/skill, PM project status/date, timesheet project/status/date, and vendor invoice status/date. Information-schema guards provide compatibility where `CREATE INDEX IF NOT EXISTS` is unsupported.

`ListControls` is the reused page navigation component. `useDebouncedValue` delays text search by 300 ms. Main pages consume the envelope rather than assuming an array. `openapi.yaml` documents the route, authentication, pagination, and error contracts.
