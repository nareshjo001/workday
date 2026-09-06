# M04 — Transactional Audit Logging Foundation

M04 records the important changes made to the VMS without creating an audit-editing API. Each row identifies the authenticated actor, action, affected entity, request correlation ID, time, and a deliberately limited before/after snapshot.

The audit row is part of the same database transaction as the business mutation. A failed audit insert therefore prevents the underlying change from committing. This provides accountable history for Vendor, PM, and Contractor actions while preserving existing ownership, tenant, allocation, financial, and lifecycle rules.

Current coverage includes contractor creation and changes, project creation and completion, assignment creation, PM allocation changes, timesheet submission/resubmission/review, milestone creation and transition to MET, and Vendor invoice review. No audit-log mutation or broad read endpoint is exposed. Future modules must add their own named critical mutations as they ship.
