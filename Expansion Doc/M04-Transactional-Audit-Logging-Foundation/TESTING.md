# Testing

Automated: `backend/test/integration/audit-log.test.js` runs the established MVP regression workflow, asserts all implemented M04 action types, actor/entity/request ID/timestamp fields, timesheet snapshots, and forbidden-secret redaction. It forces an audit repository failure during project creation and verifies that no project is committed.

Manual representative E2E verification used the same live API workflow: Vendor created contractors and assignment; PM created project/milestones, allocated hours, reviewed timesheets and completed the project; Vendor reviewed the generated invoice. Corresponding audit rows were present with the authenticated actor and request ID. Result: PASS.

Regression: `npm test` passed after the M04 changes, including secure-authentication, legacy MVP/concurrency/billing/invoice, release eligibility, observability, and M04 audit coverage.
