# M13 File Changes

- `backend/src/migrations/028_candidate_response_sla.sql` — project response-policy column.
- `backend/src/repositories/staffingPipelineRepository.js` — scoped requirement/funnel query.
- `backend/src/services/staffingPipelineService.js` — filter validation and derived SLA calculation.
- `backend/src/controllers/staffingPipelineController.js`, PM/Vendor routes — read endpoints.
- project repository and validation — SLA setting persistence and validation.
- `backend/test/integration/m13-staffing-pipeline.test.js` — lifecycle, scope, and SLA tests.
- `frontend/src/components/staffing/StaffingPipelineView.jsx` plus PM/Vendor pages and service — operational views and routes.
- project settings and project/vendor screens — SLA edit and pipeline navigation.
