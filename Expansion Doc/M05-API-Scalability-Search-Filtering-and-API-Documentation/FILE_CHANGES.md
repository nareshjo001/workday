# File changes

## Added files

- `backend/src/utils/listQuery.js` — shared safe pagination/query parsing.
- `backend/src/migrations/019_list_query_indexes.sql` — supporting composite indexes.
- `backend/test/integration/m05-pagination.test.js` — list contract and tenant-scope regression coverage.
- `frontend/src/components/ListControls.jsx` and `frontend/src/hooks/useDebouncedValue.js` — reusable paging/search UI pieces.
- `openapi.yaml` — API contract reference.
- M05 Expansion Doc files — module record.

## Modified files

- Backend list controllers, services, and repositories for contractors, projects, timesheets, and invoices — SQL pagination/filtering and envelopes.
- Frontend list services/pages — explicit query parameters, envelope consumption, search, and page controls.
- `backend/mvp_fix_test.js` and `backend/e2e_test.js` — regression callers updated to the envelope.

## Deleted files

Deleted files: None.
