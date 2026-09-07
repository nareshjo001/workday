process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m11-test-only-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server; let baseUrl; let sequence = 0;
const email = (prefix) => `${prefix}-${Date.now()}-${++sequence}@test.example`;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function request(method, path, body, token) { const headers = { "Content-Type": "application/json" }; if (token) headers.Authorization = `Bearer ${token}`; const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); return { response, data: await response.json() }; }
async function signup(role) { const address = email(role.toLowerCase()); const password = "Password123!"; const body = { name: role, email: address, password, role }; if (role === "PM") body.companyName = `M11 Company ${sequence}`; assert.equal((await request("POST", "/auth/signup", body)).response.status, 201); return (await request("POST", "/auth/login", { email: address, password })).data.token; }
async function project(pm, name, start, end) { const created = await request("POST", "/pm/projects", { name, start_date: start, end_date: end, expected_hours: 10, requirements: [{ skill: "FRONTEND", required_count: 1 }] }, pm); assert.equal(created.response.status, 201); return { id: created.data.id, requirementId: created.data.requirements[0].id }; }

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M11 prevents overlapping staffing, respects unavailability, and preserves released history", { timeout: 60000 }, async () => {
  const pm = await signup("PM"); const vendor = await signup("VENDOR");
  const contractorEmail = email("contractor");
  const createdContractor = await request("POST", "/vendor/contractors", { name: "M11 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 80 }, vendor);
  assert.equal(createdContractor.response.status, 201);
  const contractorLogin = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" }); const contractor = contractorLogin.data.token;
  assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, contractor)).response.status, 200);
  const first = await project(pm, "M11 First", day(0), day(3));
  const second = await project(pm, "M11 Second", day(4), day(8));
  assert.equal((await request("POST", `/vendor/projects/${first.id}/requirements/${first.requirementId}/assign`, { contractorIds: [createdContractor.data.id], start_date: day(0), end_date: day(3) }, vendor)).response.status, 201);
  assert.equal((await request("POST", `/vendor/projects/${second.id}/requirements/${second.requirementId}/assign`, { contractorIds: [createdContractor.data.id], start_date: day(4), end_date: day(8) }, vendor)).response.status, 201);
  const overlapping = await project(pm, "M11 Overlap", day(2), day(6));
  const blocked = await request("POST", `/vendor/projects/${overlapping.id}/requirements/${overlapping.requirementId}/assign`, { contractorIds: [createdContractor.data.id], start_date: day(2), end_date: day(6) }, vendor);
  assert.equal(blocked.response.status, 409); assert.match(blocked.data.message, /overlapping active assignment/i);
  const released = await request("PATCH", `/pm/projects/${first.id}/contractors/${createdContractor.data.id}/release`, { actual_end_date: day(1), reason: "Engagement completed early" }, pm);
  assert.equal(released.response.status, 200); assert.equal(released.data.assignment_status, "RELEASED");
  const history = await request("GET", `/pm/projects/${first.id}/contractors`, undefined, pm);
  assert.equal(history.response.status, 200); assert.equal(history.data[0].assignment_status, "RELEASED"); assert.equal(history.data[0].actual_end_date, day(1)); assert.equal(history.data[0].release_reason, "Engagement completed early");
  const availability = await request("POST", `/vendor/contractors/${createdContractor.data.id}/availability`, { start_date: day(10), end_date: day(12), reason: "Leave" }, vendor);
  assert.equal(availability.response.status, 201);
  const unavailableProject = await project(pm, "M11 Availability", day(10), day(12));
  const unavailable = await request("POST", `/vendor/projects/${unavailableProject.id}/requirements/${unavailableProject.requirementId}/assign`, { contractorIds: [createdContractor.data.id], start_date: day(10), end_date: day(12) }, vendor);
  assert.equal(unavailable.response.status, 409); assert.match(unavailable.data.message, /unavailable/i);
  const availabilityList = await request("GET", "/contractor/availability", undefined, contractor);
  assert.equal(availabilityList.response.status, 200); assert.equal(availabilityList.data.length, 1);
  const raceA = await project(pm, "M11 Race A", day(14), day(16)); const raceB = await project(pm, "M11 Race B", day(14), day(16));
  const race = await Promise.all([raceA, raceB].map((item) => request("POST", `/vendor/projects/${item.id}/requirements/${item.requirementId}/assign`, { contractorIds: [createdContractor.data.id], start_date: day(14), end_date: day(16) }, vendor)));
  assert.deepEqual(race.map((result) => result.response.status).sort(), [201, 409]);
});
