# M10 testing

## Completion compatibility regression

The historical MVP regression creates billing from Project 1 milestones. Those invoices remain `PENDING_REVIEW` until the Vendor reviews them. M10 correctly rejects `PATCH /api/pm/projects/:id/complete` in that state with:

- HTTP `409`
- code `CONFLICT`
- message `Resolve pending vendor invoice reviews before completing this project.`

`backend/mvp_fix_test.js` now verifies that block, approves Project 1's pending invoices through `PATCH /api/vendor/invoices/:id`, retries completion, and verifies the existing release assertions. It does not alter production data directly or bypass lifecycle controls.

Run `npm run test:coverage` from `backend` for the full integration and coverage suite.
