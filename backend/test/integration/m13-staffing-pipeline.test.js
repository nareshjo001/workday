process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = "m13-test";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
const { deriveCandidateSla } = require("../../src/services/staffingPipelineService");

let server; let base; let sequence = 0;
const email = (kind) => `m13-${kind}-${Date.now()}-${++sequence}@test.example`;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function request(method, path, body, token) { const headers = { "Content-Type": "application/json" }; if (token) headers.Authorization = `Bearer ${token}`; const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); return { response, data: await response.json() }; }
async function signup(role) { const address = email(role); const body = { name: role, email: address, password: "Password123!", role }; if (role === "PM") body.companyName = `M13 Company ${sequence}`; assert.equal((await request("POST", "/auth/signup", body)).response.status, 201); return { email: address, token: (await request("POST", "/auth/login", { email: address, password: "Password123!" })).data.token }; }
async function contractor(vendor, label) { const address = email(label); const created = await request("POST", "/vendor/contractors", { name: label, email: address, password: "Password123!", hourly_rate: 80 }, vendor); assert.equal(created.response.status, 201); const token = (await request("POST", "/auth/login", { email: address, password: "Password123!" })).data.token; assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, token)).response.status, 200); return created.data.id; }

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M13 reports a scoped funnel and derives response SLA without persisting breach state", { timeout: 60000 }, async () => {
  const pm = await signup("PM"); const vendor = await signup("VENDOR"); const outsider = await signup("VENDOR");
  const project = await request("POST", "/pm/projects", { name: "M13 pipeline", start_date: day(0), end_date: day(5), expected_hours: 40, requirements: [{ skill: "FRONTEND", required_count: 2 }] }, pm.token);
  assert.equal(project.response.status, 201); const projectId = project.data.id; const requirementId = project.data.requirements[0].id;
  const [[vendorRow]] = await pool.query("SELECT id FROM users WHERE email = ?", [vendor.email]);
  assert.equal((await request("POST", "/pm/vendor-access", { vendorId: vendorRow.id, projectId }, pm.token)).response.status, 201);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { candidate_response_sla_hours: 1 }, pm.token)).response.status, 200);
  const accepted = await contractor(vendor.token, "accepted"); const rejected = await contractor(vendor.token, "rejected"); const withdrawn = await contractor(vendor.token, "withdrawn"); const waiting = await contractor(vendor.token, "waiting");
  const submit = async (contractorId) => request("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId, start_date: day(0), end_date: day(5) }, vendor.token);
  const acceptedSubmission = await submit(accepted); const rejectedSubmission = await submit(rejected); const withdrawnSubmission = await submit(withdrawn); const waitingSubmission = await submit(waiting);
  for (const item of [acceptedSubmission, rejectedSubmission, withdrawnSubmission, waitingSubmission]) assert.equal(item.response.status, 201, JSON.stringify(item.data));
  assert.equal((await request("PATCH", `/pm/candidate-submissions/${acceptedSubmission.data.id}`, { status: "ACCEPTED" }, pm.token)).response.status, 200);
  assert.equal((await request("PATCH", `/pm/candidate-submissions/${rejectedSubmission.data.id}`, { status: "REJECTED", reason: "Not the current fit" }, pm.token)).response.status, 200);
  assert.equal((await request("PATCH", `/vendor/candidate-submissions/${withdrawnSubmission.data.id}/withdraw`, undefined, vendor.token)).response.status, 200);
  // There is no business API that changes a submission timestamp; this is a
  // deterministic clock fixture for read-time SLA calculation only.
  await pool.query("UPDATE candidate_submissions SET submitted_at = DATE_SUB(NOW(), INTERVAL 2 HOUR) WHERE id = ?", [waitingSubmission.data.id]);
  const pmPipeline = await request("GET", `/pm/staffing-pipeline?project_id=${projectId}&skill=FRONTEND&sla_breached=true`, undefined, pm.token);
  assert.equal(pmPipeline.response.status, 200, JSON.stringify(pmPipeline.data)); assert.equal(pmPipeline.data.items.length, 1);
  const row = pmPipeline.data.items[0];
  assert.deepEqual({ submitted: row.submitted_count, accepted: row.accepted_count, rejected: row.rejected_count, withdrawn: row.withdrawn_count, open: row.open_positions }, { submitted: 1, accepted: 1, rejected: 1, withdrawn: 1, open: 1 });
  assert.equal(row.sla_breached, true); assert.ok(row.due_at); assert.equal(row.candidate_response_sla_hours, 1);
  const vendorPipeline = await request("GET", `/vendor/staffing-pipeline?project_id=${projectId}`, undefined, vendor.token);
  assert.equal(vendorPipeline.response.status, 200); assert.equal(vendorPipeline.data.items[0].submitted_count, 1);
  const outsiderPipeline = await request("GET", `/vendor/staffing-pipeline?project_id=${projectId}`, undefined, outsider.token);
  assert.equal(outsiderPipeline.response.status, 200); assert.equal(outsiderPipeline.data.items.length, 0);
  assert.equal((await request("GET", "/pm/staffing-pipeline?status=INVALID", undefined, pm.token)).response.status, 400);
});

test("M13 treats the exact UTC due instant as breached", () => {
  const submittedAt = "2026-01-01T00:00:00.000Z";
  assert.equal(deriveCandidateSla(submittedAt, 2, new Date("2026-01-01T01:59:59.999Z")).sla_breached, false);
  const boundary = deriveCandidateSla(submittedAt, 2, new Date("2026-01-01T02:00:00.000Z"));
  assert.equal(boundary.due_at, "2026-01-01T02:00:00.000Z"); assert.equal(boundary.sla_breached, true);
});
