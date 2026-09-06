# File Changes

## Added files

- `backend/test/helpers/testDatabase.js` — guarded isolated database reset and migration helper.
- `backend/test/integration/legacy-regressions.test.js` — automated API regression wrapper.
- `frontend/vitest.config.js`, `frontend/src/test/setup.js`, and `frontend/src/routes/ProtectedRoute.test.jsx` — frontend test runner and route-guard coverage.
- `.github/workflows/ci.yml` — MySQL-backed CI pipeline.
- `Expansion Doc/M01-Automated-Regression-and-CI/*` — module documentation.

## Modified files

- `backend/package.json` and lockfile — test and coverage commands/dependency; c8 include patterns are quoted and test discovery is shell-independent.
- `.github/workflows/ci.yml`, `.nvmrc`, and `frontend/package.json` — standardize CI/development on Node 24.18.0, which the resolved frontend test dependencies support.
- `Expansion/Workday_VMS_Expansion_Feature_Tracker.xlsx` — M01 completion note records verified green GitHub Actions push and pull-request runs.
- `backend/src/config/env.js` — test database name guard.
- `backend/mvp_fix_test.js` and `backend/eligible_contractor_release_test.js` — configurable API base URL for automated execution.
- `frontend/package.json` and lockfile — Vitest/React Testing Library commands/dependencies.

## Deleted files

Deleted files: None.
