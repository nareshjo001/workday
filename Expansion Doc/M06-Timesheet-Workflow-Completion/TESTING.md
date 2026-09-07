# Testing

## Automated

`backend/test/integration/m06-timesheet-workflow.test.js` covers the end-to-end daily workflow:

- draft creation with description and no submitted timestamp;
- PM queue exclusion before explicit submit;
- contractor-owned atomic submit;
- required rejection reason;
- rejected-row correction, review-field/reason clearing, and resubmission;
- PM bulk approval;
- stale/replay rejection (409); and
- wrong-role bulk-review rejection (403).

The full backend suite and coverage suite passed: 7 integration tests passed, and enforced c8 thresholds passed (77.70% lines, 70.93% functions, 65.94% branches). Existing allocation, milestone, billing, invoice, release, audit, session, observability, and M05 list regressions stayed green.

Frontend validation passed: `npm test` (2 files / 5 tests), `npm run lint` (pass with existing Fast Refresh warnings), and `npm run build`.

## Representative manual E2E verification

TEST: Contractor saves a described daily draft.
EXPECTED: Draft is absent from PM queue and has no submitted timestamp.
ACTUAL: Verified by live API integration workflow.
RESULT: PASS

TEST: Contractor submits draft; PM rejects with an explanation; contractor corrects and resubmits.
EXPECTED: Submitted row enters PM queue; rejection reason is visible; correction returns to DRAFT and clears prior review data; explicit submit returns it to queue.
ACTUAL: Verified by live API integration workflow.
RESULT: PASS

TEST: PM bulk-approves selected submitted rows, then retries.
EXPECTED: First operation succeeds atomically; replay receives 409.
ACTUAL: Verified by live API integration workflow.
RESULT: PASS

TEST: Vendor calls PM bulk-review endpoint.
EXPECTED: 403 with no mutation.
ACTUAL: Verified by live API integration workflow.
RESULT: PASS
