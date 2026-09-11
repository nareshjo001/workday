# M24 — Decision Intelligence Foundation

## Objective

M24 adds the reusable, deterministic-first contract that later intelligence modules will use. It adds no rate, project-control, invoice, assignment, candidate, or timesheet intelligence rules.

## Architecture

`Trusted VMS data -> deterministic rule/calculation -> structured finding -> optional explanation -> authorized human decision`

The structured finding is authoritative. Natural-language wording is optional and cannot become a financial, compliance, approval, assignment, project, rate, or timesheet source of truth.

## Finding contract

`backend/src/utils/intelligenceFinding.js` exports `createFinding(input)`. A valid result has:

- `code`: stable non-empty machine-readable string.
- `severity`: normalized shared value (`INFO`, `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`).
- `title`, `summary`, and `recommended_action`: non-empty advisory text.
- `evidence`: an array of deliberately selected `{ key, label, value, unit? }` values. `value` is only string, number, boolean, or null; records, SQL rows, and internal objects are rejected.
- `source`: `{ engine, version }` identifying the deterministic engine.

No hidden reasoning, raw model response, or internal record is part of the contract.

## Explanation seam and fallback

`backend/src/services/intelligenceExplanationService.js` exposes `explainFinding(finding, context)`. M24 deliberately has no external provider or dependency: the fallback always returns `finding.summary`. A future provider may only rephrase the provided finding/evidence for its authorized tenant scope. It must not invent evidence, alter calculations or severity, recommend financial values, make state changes, reveal hidden reasoning, or send data beyond the authorized tenant.

If an explanation integration is absent or unavailable, engines and ordinary VMS workflows continue with deterministic findings. Findings are not persisted in M24, so half-generated wording cannot be stored.

## Feature flags

The backend environment flags all default to `false`:

- `INTELLIGENCE_VENDOR_RATE_ENABLED`
- `INTELLIGENCE_PM_PROJECT_CONTROL_ENABLED`
- `INTELLIGENCE_CONTRACTOR_TIMESHEET_ENABLED`
- `INTELLIGENCE_AI_EXPLANATIONS_ENABLED`

They only control discovery. They do not enable an engine; M25+ owns any real feature implementation.

## Capability endpoint

`GET /api/intelligence/capabilities` requires the normal Bearer JWT/session validation and derives identity exclusively from `req.user`. It accepts no actor or role selector. Response contract version is `"1"` and returns capability booleans. Vendor-only, PM-only, and Contractor-only flags are `false` for other roles even if the corresponding global configuration is enabled. It performs no tenant business-data query.

The frontend foundation is `frontend/src/services/intelligenceService.js`; it requests only this endpoint, validates the response shape before exposing capability values, and adds no visible UI, navigation, or business workflow.

## Human decision ownership and audit strategy

Intelligence may detect, compare, calculate, recommend, explain, and flag. It never approves/rejects timesheets or invoices, accepts/rejects candidates, changes rates, assigns contractors, closes projects, or changes financial records. Existing authorized workflow endpoints remain the only place those actions occur.

M24 adds no artificial audit events. Future meaningful user actions—such as applying a recommendation, acknowledging a warning, or accepting wording—must use the existing `auditService.write(conn, actor, action, entityType, entityId, before, after)` inside their transactional business workflow.

## Files changed

- Backend configuration, shared severity constants, finding validator, deterministic explanation seam, capability service/controller/route, and M24 integration tests.
- Frontend capability-discovery service and focused test.
- `backend/.env.example` and this document.

## Tests

`backend/test/integration/m24-decision-intelligence.test.js` covers contract validation, explanation fallback, authentication/error shape, role isolation, feature configuration, and ignored client role/user query hints. `frontend/src/services/intelligenceService.test.js` verifies the frontend calls the role-derived endpoint with no role parameters and rejects malformed capability payloads.

## Limitations and explicit non-goals

There is no persistence, database migration, model/provider, prompt framework, background worker, vector store, chat UI, audit UI, or intelligence business feature. Vendor rate recommendations, margin/rate prediction, PM health scoring, timesheet/invoice anomaly detection, candidate screening/ranking, and all M25+ intelligence are intentionally not implemented.
