# M13 Testing

`backend/test/integration/m13-staffing-pipeline.test.js` verifies:

- funnel totals after acceptance, rejection, withdrawal, and a pending submission;
- project SLA policy update and a derived breached requirement;
- PM ownership scope, Vendor relationship scope, and an unconnected Vendor receiving no pipeline data;
- invalid filter rejection;
- an exact UTC SLA boundary: one millisecond before is not breached and the exact due instant is breached.

Run the full backend regression and coverage gate with `npm run test:coverage` from `backend`, and the frontend checks with `npm run lint` and `npm run build` from `frontend`.
