# File Changes

## Added files

- `backend/src/migrations/020_timesheet_workflow_completion.sql` — forward-only daily timesheet workflow migration.
- `backend/test/integration/m06-timesheet-workflow.test.js` — end-to-end M06 API and state-transition coverage.
- `frontend/src/components/timesheets/RejectTimesheetModal.jsx` — validated PM rejection-reason UI.
- `Expansion Doc/M06-Timesheet-Workflow-Completion/*` — module implementation, testing, audit, and change documentation.

## Modified files

- Backend contractor/PM timesheet routes, controllers, validators, services, and repository — draft, submit, reasoned review, bulk review, and state/lock rules.
- `backend/src/repositories/assignmentRepository.js` and `backend/src/services/contractorDashboardService.js` — treat DRAFT/SUBMITTED work as pending/reserved where required.
- `backend/mvp_fix_test.js` and `backend/test/integration/audit-log.test.js` — preserve existing regression/audit expectations under explicit submission.
- Frontend timesheet pages, dialogs, grouping, tables, cards, format helpers, and API clients — descriptions, draft/submit UX, rejection visibility, and PM bulk actions.
- `openapi.yaml` — M06 endpoint and workflow descriptions.

## Deleted files

Deleted files: None.
