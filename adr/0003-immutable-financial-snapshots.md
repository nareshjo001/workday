# ADR 0003: Immutable Financial Snapshots

## Status

Accepted — hackathon baseline.

## Decision

Milestone billing stores approved hours, rate, and amount once; invoices copy that snapshot. Later contractor rate changes never recalculate historic billing or invoice values.
