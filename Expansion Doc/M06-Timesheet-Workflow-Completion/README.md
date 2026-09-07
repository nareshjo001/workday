# M06 — Timesheet Workflow Completion

M06 completes the daily timesheet lifecycle: contractors save daily work as drafts, explicitly submit selected daily entries for review, and PMs approve or reject those submitted entries. A rejection now always includes an explanation and the contractor can correct the same historical row before submitting it again.

Before M06, creating a daily log immediately put it in the PM queue. There was no work description, no explicit draft state, no required rejection reason, and no PM bulk-review action.

Contractors now have a weekly workspace built from daily rows. They can save a draft, add a work description, submit visible drafts or a single week, see rejection feedback, correct a rejected row, and resubmit it. PMs see only submitted rows for their own projects and can approve/reject one row or selected rows together.

Important rules:

- One row remains one contractor/project/work-date; the database uniqueness rule remains in force.
- `DRAFT`, `SUBMITTED`, and `APPROVED` hours reserve allocation; `REJECTED` hours do not.
- Only `SUBMITTED` can be reviewed; only `REJECTED` can be corrected; `APPROVED` remains immutable.
- Approved hours remain the only input to milestones, billing, and invoices.
- A Vendor cannot review timesheets; a PM cannot review another PM’s project rows; a released or inactive contractor cannot submit old drafts.
