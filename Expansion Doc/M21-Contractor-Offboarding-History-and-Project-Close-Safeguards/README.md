# M21 — Contractor Offboarding, History & Project Close Safeguards

M21 makes ending an assignment or completing a project an explicit, traceable operational action. It preserves assignments, timesheets, billings, invoices, payments, rate snapshots, and audit records; no history is deleted or recalculated.

## Release and close policy

| Condition | Assignment release | Project completion |
| --- | --- | --- |
| Submitted timesheet | Blocker | Blocker |
| Rejected timesheet | Warning | Warning |
| Active assignment | N/A | Warning; released atomically on completion |
| Open candidate review | N/A | Blocker |
| Submitted invoice | N/A | Blocker |
| Uninvoiced billing / draft invoice | Warning | Warning |
| Outstanding or overdue approved invoice | Warning | Warning |

Warnings are visible to the caller and require confirmation in the PM close UI. They never silently erase financial work.
