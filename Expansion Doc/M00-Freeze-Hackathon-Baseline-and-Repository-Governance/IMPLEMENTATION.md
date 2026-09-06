# Implementation

## Previous workflow

The root README described only authentication even though the repository implemented staffing, allocation, daily time approval, milestone billing, invoices, release, and dashboards. Current and superseded regression scripts were not surfaced in project documentation.

## New workflow

The repository now has a current-system README plus architecture, database, API, roadmap, changelog, and ADR references. Expansion modules have a standard documentation location.

## Scope and invariants

No migration, backend route, service, repository, frontend component, or runtime configuration changed. The verification-only sample RBAC route remains because M01 has not yet provided equivalent automated coverage.

Recorded invariants:

- JWT-derived actor identity, role routing, SQL ownership checks, and protected cross-tenant 404 semantics.
- Explicit transactions, row locks, conditional transitions, and unique-key race backstops.
- Daily timesheets, active/released assignment history, project-wide milestone triggers, contractor-specific immutable billing, and immutable invoices.

## Baseline tag

The repository owner manually created annotated tag `v1.0-hackathon` at `4bd5cd1`, the verified final committed hackathon baseline. Agent policy continues to prohibit Git tag and commit mutations; the remaining M00 documentation and tracker updates are prepared for the owner's final M00 commit.
