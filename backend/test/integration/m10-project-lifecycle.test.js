process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m10-test-only-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server; let baseUrl; let sequence = 0;
const email = (prefix) => `${prefix}-${Date.now()}-${++sequence}@test.example`;
async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" }; if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, data: await response.json() };
}
async function signup(role, address) {
  const password = "Password123!"; const body = { name: role, email: address, password, role };
  if (role === "PM") body.companyName = `M10 Company ${sequence}`;
  assert.equal((await request("POST", "/auth/signup", body)).response.status, 201);
  const login = await request("POST", "/auth/login", { email: address, password }); assert.equal(login.response.status, 200);
  return login.data.token;
}

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M10 safely manages project lifecycle, requirements, and time policies", { timeout: 60000 }, async () => {
  const pm = await signup("PM", email("pm")); const vendor = await signup("VENDOR", email("vendor"));
  const contractorEmail = email("contractor");
  const contractorCreated = await request("POST", "/vendor/contractors", { name: "M10 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 80 }, vendor);
  assert.equal(contractorCreated.response.status, 201);
  const secondEmail = email("contractor");
  const secondCreated = await request("POST", "/vendor/contractors", { name: "M10 Second Contractor", email: secondEmail, password: "Password123!", hourly_rate: 80 }, vendor);
  assert.equal(secondCreated.response.status, 201);
  const contractorLogin = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" }); const contractor = contractorLogin.data.token;
  assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, contractor)).response.status, 200);
  const secondLogin = await request("POST", "/auth/login", { email: secondEmail, password: "Password123!" });
  assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, secondLogin.data.token)).response.status, 200);
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/pm/projects", { name: "M10 Lifecycle", start_date: today, expected_hours: 10, requirements: [{ skill: "FRONTEND", required_count: 2 }] }, pm);
  assert.equal(created.response.status, 201); const projectId = created.data.id; const requirementId = created.data.requirements[0].id;
  assert.equal((await request("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/assign`, { contractorIds: [contractorCreated.data.id, secondCreated.data.id] }, vendor)).response.status, 201);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/contractors/${contractorCreated.data.id}/allocation`, { allocated_hours: 8 }, pm)).response.status, 200);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/contractors/${secondCreated.data.id}/allocation`, { allocated_hours: 1 }, pm)).response.status, 200);

  const policies = await request("PATCH", `/pm/projects/${projectId}`, { budget: 1000, currency: "usd", max_hours_per_day: 6, max_hours_per_week: 8, allow_weekend: true, backdate_limit_days: 7 }, pm);
  assert.equal(policies.response.status, 200); assert.equal(policies.data.currency, "USD"); assert.equal(policies.data.budget, 1000);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { budget: -1 }, pm)).response.status, 400);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { expected_hours: 7 }, pm)).response.status, 409);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { start_date: "2099-01-01" }, pm)).response.status, 409);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/requirements/${requirementId}`, { required_count: 0 }, pm)).response.status, 400);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/requirements/${requirementId}`, { required_count: 0.5 }, pm)).response.status, 400);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/requirements/${requirementId}`, { required_count: 1 }, pm)).response.status, 409);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/requirements/${requirementId}`, { status: "CLOSED", description: "Hiring paused" }, pm)).response.status, 200);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { status: "ON_HOLD" }, pm)).response.status, 200);
  assert.equal((await request("POST", "/contractor/timesheets", { projectId, workDate: today, hoursLogged: 4, description: "Blocked while on hold" }, contractor)).response.status, 409);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}`, { status: "ACTIVE" }, pm)).response.status, 200);
  const draft = await request("POST", "/contractor/timesheets", { projectId, workDate: today, hoursLogged: 6, description: "M10 work" }, contractor);
  assert.equal(draft.response.status, 201);
  assert.equal((await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, contractor)).response.status, 200);
  assert.equal((await request("PATCH", `/pm/projects/${projectId}/complete`, undefined, pm)).response.status, 409);
  assert.equal((await request("PATCH", `/pm/timesheets/${draft.data.id}`, { status: "APPROVED" }, pm)).response.status, 200);
  const complete = await request("PATCH", `/pm/projects/${projectId}/complete`, undefined, pm);
  assert.equal(complete.response.status, 200); assert.equal(complete.data.project.status, "COMPLETED"); assert.equal(complete.data.released_assignment_count, 2);
});
