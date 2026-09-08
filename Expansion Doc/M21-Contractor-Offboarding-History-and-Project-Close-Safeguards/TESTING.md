# Testing

Dedicated coverage is in `backend/test/integration/m21-offboarding.test.js`.

It verifies Vendor release metadata, readiness, preserved history, tenant isolation, release audit identity/correlation, and rollback when audit persistence fails. Existing M10 lifecycle coverage verifies project completion and release regression behavior.

Verification run for the completed module:

- dedicated M21 integration test: pass
- M10 lifecycle/regression suite: pass
- backend coverage suite: pass
- frontend tests, lint, and production build: pass
- `git diff --check`: pass
