# File Changes

## Added files

- `backend/test/helpers/testDatabase.js` — guarded isolated database reset and migration helper.
- `backend/test/integration/legacy-regressions.test.js` — automated API regression wrapper.
- `frontend/vitest.config.js`, `frontend/src/test/setup.js`, and `frontend/src/routes/ProtectedRoute.test.jsx` — frontend test runner and route-guard coverage.
- `.github/workflows/ci.yml` — MySQL-backed CI pipeline.
- `Expansion Doc/M01-Automated-Regression-and-CI/*` — module documentation.

## Modified files

- `backend/package.json` and lockfile — test and coverage commands/dependency.
- `backend/src/config/env.js` — test database name guard.
- `backend/mvp_fix_test.js` and `backend/eligible_contractor_release_test.js` — configurable API base URL for automated execution.
- `frontend/package.json` and lockfile — Vitest/React Testing Library commands/dependencies.

## Deleted files

Deleted files: None.
