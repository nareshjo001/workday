# ADR 0002: Tenant Boundaries and Sensitive 404 Semantics

## Status

Accepted — hackathon baseline.

## Decision

Actor identity comes only from verified JWT context. Sensitive resource ownership checks use the same 404 for missing and inaccessible resources; wrong-role route access remains 403.
