# Implementation

Rate cards are relationship-scoped by client, vendor, skill, and inclusive effective dates. Active periods cannot overlap. Candidate acceptance resolves the applicable card for the proposed start date and stores bill rate, cost rate, currency, and card id on the assignment. If no card exists, the legacy contractor rate remains the documented compatibility fallback. Existing milestone billings are never rewritten.

New milestone billing reads the immutable assignment bill-rate snapshot; legacy assignments without a snapshot continue to use the pre-existing contractor default. A rate card referenced by an assignment cannot be changed. Vendors create, list, and update their own relationship-scoped cards; every mutation is audited in the same transaction.
