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

## CI portability retest

GitHub Actions initially failed on Ubuntu while running `npm run test:coverage`: POSIX shell expansion converted unquoted `src/services/**` and `src/repositories/**` into filenames before c8 received them, causing c8 to attempt to spawn a source file and fail with `EACCES`. Windows `cmd.exe` did not expand the globs, which is why local Windows coverage passed.

The command now quotes both c8 include patterns and names the owned integration entry point explicitly: `test/integration/legacy-regressions.test.js`. This avoids both shell glob expansion and Node's default discovery of retained root-level legacy scripts. Local backend test/coverage, frontend test, frontend lint, and frontend production build were rerun after the fix.

## Frontend CI runtime compatibility retest

The subsequent CI failure occurred before test execution on Node `20.20.2`: `webidl.util.markAsUncloneable is not a function` arose while jsdom loaded resolved undici. The lockfile resolves Vitest `5.0.0` (Node `^22.12.0 || ^24.0.0 || >=26`), jsdom `30.0.1` (Node `^22.22.2 || ^24.15.0 || >=26`), and undici `8.10.2` (Node `>=22.19.0`). Node 20 is therefore outside the supported dependency range.

Local Windows had passed on Node `24.18.0` and npm `11.16.0`. CI now reads the same `24.18.0` runtime from root `.nvmrc`; frontend `package.json` declares Node `>=24.15.0 <25`. No tests, jsdom environment, workers, dependencies, or coverage thresholds changed.
