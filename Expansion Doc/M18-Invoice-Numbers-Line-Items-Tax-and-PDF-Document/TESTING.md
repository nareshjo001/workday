# Testing

`backend/test/integration/m18-invoice-documents.test.js` runs the current
end-to-end business fixture against a fresh test database. It verifies draft
tax and named adjustment lines, derived totals, immutable item snapshots,
concurrent same-vendor submissions with unique consecutive numbers, PDF
content and freeze behavior, authorized Vendor/PM downloads, and hidden
cross-tenant Vendor/PM probes. The M17 approval and rejection paths remain
part of that fixture.

It also verifies the year boundary (`INV-2027-000001` after an invoice date
change to 2027), derived due date, immutable submitted metadata, escaped PDF
content, and that an approved document is byte-for-byte the submitted
document. The database key and `FOR UPDATE` sequence lock are exercised by
parallel submissions rather than a client-side uniqueness assumption.

Backend regression and coverage suites pass. Frontend tests, lint, and
production build pass.

The test flow also preserves M17's billing queue, Vendor draft, submission,
and PM approval/rejection lifecycle.
