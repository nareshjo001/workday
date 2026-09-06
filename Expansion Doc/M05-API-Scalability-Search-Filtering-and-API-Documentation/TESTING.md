# Testing

Automated: `backend/test/integration/m05-pagination.test.js` verifies default and explicit envelopes, totals, page size, deterministic ordering, text filtering, invalid-page rejection, and cross-vendor SQL scoping. The full backend integration suite was run, including M02 security, M03 observability, M04 audit rollback, allocation/billing/invoice regression, and release eligibility. Backend coverage continues to enforce the existing thresholds.

Frontend `npm run lint`, `npm run build`, and `npm test` passed. Lint retains existing fast-refresh warnings in shared formatting files.

TEST: Vendor requests contractors with `page=1&pageSize=1&search=ali&sort=name&order=asc`.
EXPECTED: one of two vendor-owned matching rows with correct metadata.
ACTUAL: one `Alice` row, `total: 2`, `total_pages: 2`.
RESULT: PASS.

TEST: A second Vendor requests the same list.
EXPECTED: no rows from the first Vendor.
ACTUAL: zero rows.
RESULT: PASS.

TEST: PM/Contractor/Vendor list screens consume envelope data and render controls.
EXPECTED: no array-contract error.
ACTUAL: production build and Vitest passed.
RESULT: PASS.
