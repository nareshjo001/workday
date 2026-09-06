# Implementation

## Previous workflow

`mvp_fix_test.js` and `eligible_contractor_release_test.js` required a manually started API and prepared database. The frontend had no test runner. CI did not exist.

## New workflow

`npm test` in `backend/` resets `vms_test`, applies migrations 001–016, starts the Express app on an ephemeral local port, and invokes the current regression scripts through that API. `API_BASE_URL` makes the scripts reusable without a hard-coded server port.

The backend test guard requires `NODE_ENV=test` and a database name ending in `_test`; reset drops and recreates only that guarded database. The application pool is closed after testing.

`npm run test:coverage` uses c8 with a 40% line/function and 30% branch threshold over services and repositories. The frontend uses Vitest, jsdom, and React Testing Library to verify anonymous, wrong-role, and allowed-role route behavior.

GitHub Actions provisions MySQL 8, installs both packages from lockfiles, then runs frontend lint, backend coverage tests, frontend tests, and the production build.

## Preserved behavior

No schema, business service, authorization rule, or frontend workflow changed. Existing transactions, locks, uniqueness constraints, and historical scripts remain intact.
