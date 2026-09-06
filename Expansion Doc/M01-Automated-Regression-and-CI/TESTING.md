# Testing

TEST: Backend automated integration suite.
EXPECTED: No manually started API; only `vms_test` is reset and migrated.
ACTUAL: PASS — 2 automated test cases invoked the current regression scripts; 111 assertions passed.

TEST: Backend coverage gate.
EXPECTED: Services/repositories meet 40% line/function and 30% branch thresholds.
ACTUAL: PASS — 75.83% lines, 64.70% branches, 64.86% functions.

TEST: Frontend route guard.
EXPECTED: Anonymous users go to login, wrong roles go to unauthorized, vendors render vendor routes.
ACTUAL: PASS — 3 Vitest/React Testing Library tests.

TEST: Frontend quality and build.
EXPECTED: Lint and production build succeed.
ACTUAL: PASS — lint exits 0 with 14 pre-existing Fast Refresh warnings; Vite build succeeds.

TEST: Concurrency regression.
EXPECTED: Simultaneous approvals crossing a milestone produce one billing contribution per contractor without duplicates.
ACTUAL: PASS — covered by the current 91-assertion MVP regression scenario.

Unsupported: local test execution needs a MySQL account permitted to create/drop `vms_test`; CI supplies one through its MySQL service.
