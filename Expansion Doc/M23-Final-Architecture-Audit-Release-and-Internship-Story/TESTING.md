# M23 Testing

## Dedicated automated coverage

`backend/test/integration/m23-final-audit.test.js` provides two final acceptance tests:

1. Complete INR financial reconciliation, exact decimal totals, approved-only work, exactly-once milestone contribution, immutable assignment/billing/item/PDF/payment history, payment-state derivation, and overpayment rejection.
2. Vendor/PM/Contractor role gates, cross-tenant privacy-safe denials, PM/Contractor commercial non-disclosure, scoped dashboards/exports, `*` CSV neutralization, revoked relationship behavior, retired-route absence, and core audit records.

Existing M11–M21 tests retain focused concurrency and lifecycle coverage. The migration integration test applies migrations `001`–`037` on a fresh schema and verifies checksum-ledger replay.

## Release verification

- Backend `npm run test:coverage`: **26/26 test files passed**, including the 112-assertion legacy regression and both M23 final-audit tests. Coverage: statements/lines 84.76%, branches 70.31%, functions 78.97% (all gates passed).
- Frontend `npm test`: **3 files / 8 tests passed**.
- Frontend `npm run lint`: exit 0 with 15 documented pre-existing Fast Refresh/hook warnings and no errors.
- Frontend `npm run build`: passed; 186 modules transformed and production assets emitted.
- M22 host Playwright lifecycle: **1/1 passed** (Vendor candidate submission through PM approval, Contractor timesheet, invoicing, approval, and payment).
- Migration integration: clean database application and checksum-ledger replay passed through migration `037`.
- Tracked-file secret scan: clean. Backend dependency audit: zero vulnerabilities after the compatible `qs` override. Frontend high-threshold audit: exit 0, retaining two documented moderate React Router advisories.
- Final whitespace validation: `git diff --check` passed; line-ending conversion notices are warnings rather than whitespace errors.

## M22 evidence retained

The Docker-hosted M22 acceptance established healthy MySQL/backend/frontend containers, readiness and SPA fallback, deterministic seed/reseed, Playwright lifecycle, persistent file storage, database backup/restore and restored login/readiness, a clean tracked-file secret scan, dependency audit at the high threshold, and a 100% successful lightweight performance smoke. M23 does not claim to have rerun host Docker from the restricted execution sandbox.
