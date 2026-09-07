# Implementation

Migration 031 adds optional description, sequence order, and due date fields. PMs can create and edit only pending milestones for projects they own. Each create/update is audited in its transaction; post-commit evaluation retains the established approved-hours-only, per-contractor, exactly-once billing engine. MET milestones reject edits.

Milestone views include metadata and immutable contribution/billing breakdowns. New billing continues to use M15 assignment bill-rate snapshots when available.
