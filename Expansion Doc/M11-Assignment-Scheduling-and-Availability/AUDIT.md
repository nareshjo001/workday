# M11 Audit

## Authorization and tenancy

- Vendor assignment uses JWT-derived vendor identity and confirms current project access before any project details are exposed.
- The contractor is locked and confirmed to belong to that vendor; a Vendor cannot staff another Vendor's contractor.
- Availability endpoints resolve the contractor from the authenticated user. Availability ids cannot be listed, created, or cancelled on behalf of another contractor.
- Individual release locks the project and checks `project.pm_id` before it finds and releases an active assignment.

## Data integrity and concurrency

- Migration 026 preserves existing assignment history while adding planned and actual dates.
- Assignment overlap checks lock relevant active assignment and availability ranges within the assignment transaction, after the project and requirement locks.
- Batch assignment remains atomic: any candidate conflict rolls back every candidate in the request.
- Release updates the active row in place, retaining its dates, reason, and released history.

## Evidence

`backend/test/integration/m11-assignment-dates.test.js` passes with the full regression suite. `git diff --check` passes.
