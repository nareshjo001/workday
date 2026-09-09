# ADR 0004: Explicit Business-Ownership Lifecycles

## Status

Accepted — portfolio release.

## Context

The hackathon MVP used shortcuts that collapsed decisions owned by different parties: a Vendor could directly assign a contractor and milestone evaluation could lead directly to an invoice/review shape.

## Decision

- Staffing is Vendor candidate submission followed by PM acceptance; acceptance alone creates an assignment.
- Approved hours create invoice-eligible milestone contributions, not invoices.
- Vendors compose and submit invoices; PM/client users approve or reject them.
- Payment settlement is derived from append-only payments and never replaces invoice approval status.
- Release/project close preserve history and apply explicit blockers/warnings.

Each transition is role- and tenant-scoped, validated in its owning service, audited transactionally when critical, and notification delivery is post-commit.

## Consequences

The workflow has more explicit states and endpoints, but ownership, auditability, financial meaning, and concurrency behavior are clearer. Retired shortcut routes are not active compatibility surfaces.
