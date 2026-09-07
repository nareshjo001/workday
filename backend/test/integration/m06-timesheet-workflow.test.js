process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m06-test-only-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server; let baseUrl; let serial = 0;
const unique = (prefix) => `${prefix}-${Date.now()}-${++serial}@test.example`;
async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" }; if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, data: await response.json() };
}
async function signup(role, email) {
  const password = "Password123!";
  const body = { name: role, email, password, role }; if (role === "PM") body.companyName = "M06 Test Company";
  assert.equal((await request("POST", "/auth/signup", body)).response.status, 201);
  const login = await request("POST", "/auth/login", { email, password }); assert.equal(login.response.status, 200);
  return { token: login.data.token, password };
}

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M06 preserves daily drafts, requires reasons, supports correction/resubmission, and atomically bulk reviews", { timeout: 60000 }, async () => {
  const pm = await signup("PM", unique("pm")); const vendor = await signup("VENDOR", unique("vendor"));
  const contractorEmail = unique("contractor");
  const created = await request("POST", "/vendor/contractors", { name: "M06 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 70 }, vendor.token);
  assert.equal(created.response.status, 201); const contractorId = created.data.id;
  const contractorLogin = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" }); assert.equal(contractorLogin.response.status, 200);
  const contractor = contractorLogin.data.token;
  assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, contractor)).response.status, 200);
  const project = await request("POST", "/pm/projects", { name: "M06 Daily Workflow", start_date: new Date().toISOString().slice(0, 10), expected_hours: 16, requirements: [{ skill: "FRONTEND", required_count: 1 }] }, pm.token);
  assert.equal(project.response.status, 201); const projectId = project.data.id; const requirementId = project.data.requirements[0].id;
  const submitted = await request("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId }, vendor.token); assert.equal(submitted.response.status, 201);
  const acceptedCandidate = await request("PATCH", `/pm/candidate-submissions/${submitted.data.id}`, { status: "ACCEPTED" }, pm.token); assert.equal(acceptedCandidate.response.status, 200, JSON.stringify(acceptedCandidate.data));
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/contractors/${contractorId}/allocation`, { allocated_hours: 16 }, pm.token)).response.status, 200);

  const draft = await request("POST", "/contractor/timesheets", { projectId, workDate: new Date().toISOString().slice(0, 10), hoursLogged: 8, description: "Build daily workflow" }, contractor);
  assert.equal(draft.response.status, 201); assert.equal(draft.data.status, "DRAFT"); assert.equal(draft.data.submitted_at, null);
  const queueBeforeSubmit = await request("GET", "/pm/timesheets/pending", undefined, pm.token); assert.equal(queueBeforeSubmit.data.total, 0);
  assert.equal((await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, contractor)).response.status, 200);
  const queue = await request("GET", "/pm/timesheets/pending", undefined, pm.token); assert.equal(queue.data.items.length, 1); assert.equal(queue.data.items[0].description, "Build daily workflow");
  assert.equal((await request("PATCH", `/pm/timesheets/${draft.data.id}`, { status: "REJECTED" }, pm.token)).response.status, 400);
  const rejected = await request("PATCH", `/pm/timesheets/${draft.data.id}`, { status: "REJECTED", rejectionReason: "Please add test evidence." }, pm.token);
  assert.equal(rejected.response.status, 200); assert.equal(rejected.data.rejection_reason, "Please add test evidence.");
  const corrected = await request("PATCH", `/contractor/timesheets/${draft.data.id}`, { workDate: new Date().toISOString().slice(0, 10), hoursLogged: 8, description: "Build workflow with tests" }, contractor);
  assert.equal(corrected.response.status, 200); assert.equal(corrected.data.status, "DRAFT"); assert.equal(corrected.data.rejection_reason, null);
  assert.equal((await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, contractor)).response.status, 200);
  const reviewed = await request("PATCH", "/pm/timesheets/bulk-review", { timesheetIds: [draft.data.id], status: "APPROVED" }, pm.token);
  assert.equal(reviewed.response.status, 200); assert.equal(reviewed.data[0].status, "APPROVED");
  assert.equal((await request("PATCH", "/pm/timesheets/bulk-review", { timesheetIds: [draft.data.id], status: "APPROVED" }, pm.token)).response.status, 409);
  assert.equal((await request("PATCH", "/pm/timesheets/bulk-review", { timesheetIds: [draft.data.id], status: "APPROVED" }, vendor.token)).response.status, 403);
});
