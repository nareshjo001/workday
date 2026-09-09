# ADR 0003: Immutable Financial Snapshots

## Status

Accepted — extended through the portfolio release.

## Decision

Candidate acceptance resolves a scoped rate card and snapshots bill rate, cost rate, currency, and rate-card identity onto the assignment. Milestone billing copies approved hours, bill rate, currency, and amount; invoice items copy the billing snapshot; a submitted invoice PDF is frozen; payments are append-only. Later rate-card, contractor, assignment, or project changes never recalculate historical billing, invoice, document, or settlement values.
