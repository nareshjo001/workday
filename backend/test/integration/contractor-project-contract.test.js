process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "contractor-project-contract-test-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server;
let baseUrl;
let sequence = 0;
const email = (prefix) => `contract-${prefix}-${Date.now()}-${++sequence}@test.example`;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function request(method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}

async function signup(role) {
  const address = email(role.toLowerCase());
  const password = "Password123!";
  const body = { name: role, email: address, password, role };
  if (role === "PM") body.companyName = `Contract Test Company ${sequence}`;
  assert.equal((await request("POST", "/auth/signup", body)).response.status, 201);
  return (await request("POST", "/auth/login", { email: address, password })).data.token;
}

async function createContractor(vendor, name) {
  const address = email(name.toLowerCase().replaceAll(" ", "-"));
  const created = await request("POST", "/vendor/contractors", {
    name, email: address, password: "Password123!", hourly_rate: 80,
  }, vendor);
  assert.equal(created.response.status, 201);
  const login = await request("POST", "/auth/login", { email: address, password: "Password123!" });
  assert.equal(login.response.status, 200);
  return { id: created.data.id, token: login.data.token };
}

async function createProject(pm, name, start, end) {
  const created = await request("POST", "/pm/projects", {
    name, start_date: start, end_date: end, expected_hours: 100,
    requirements: [{ skill: "BACKEND", required_count: 1 }],
  }, pm);
  assert.equal(created.response.status, 201);
  return { id: created.data.id, requirementId: created.data.requirements[0].id };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("contractor projects exposes unambiguous project and assignment fields without changing visibility scope", { timeout: 60000 }, async () => {
  const pm = await signup("PM");
  const vendor = await signup("VENDOR");
  const contractorA = await createContractor(vendor, "Contractor A");
  const contractorB = await createContractor(vendor, "Contractor B");

  const releasedDates = { projectStart: day(0), projectEnd: day(10), assignmentStart: day(1), assignmentEnd: day(4) };
  const activeDates = { projectStart: day(11), projectEnd: day(30), assignmentStart: day(12), assignmentEnd: day(20) };
  const otherDates = { projectStart: day(31), projectEnd: day(45), assignmentStart: day(32), assignmentEnd: day(40) };
  const releasedProject = await createProject(pm, "Released History", releasedDates.projectStart, releasedDates.projectEnd);
  const activeProject = await createProject(pm, "Current Assignment", activeDates.projectStart, activeDates.projectEnd);
  const otherProject = await createProject(pm, "Other Contractor Project", otherDates.projectStart, otherDates.projectEnd);

  await pool.query("UPDATE projects SET status='COMPLETED' WHERE id=?", [releasedProject.id]);
  await pool.query(
    "INSERT INTO project_assignments (contractor_id,project_id,requirement_id,assigned_date,start_date,end_date,status,released_at) VALUES (?,?,?,?,?,?,'RELEASED','2026-02-16 09:30:00')",
    [contractorA.id, releasedProject.id, releasedProject.requirementId, releasedDates.assignmentStart, releasedDates.assignmentStart, releasedDates.assignmentEnd]
  );
  await pool.query(
    "INSERT INTO project_assignments (contractor_id,project_id,requirement_id,assigned_date,start_date,end_date,status) VALUES (?,?,?,?,?,?,'ACTIVE')",
    [contractorA.id, activeProject.id, activeProject.requirementId, activeDates.assignmentStart, activeDates.assignmentStart, activeDates.assignmentEnd]
  );
  await pool.query(
    "INSERT INTO project_assignments (contractor_id,project_id,requirement_id,assigned_date,start_date,end_date,status) VALUES (?,?,?,?,?,?,'ACTIVE')",
    [contractorB.id, otherProject.id, otherProject.requirementId, otherDates.assignmentStart, otherDates.assignmentStart, otherDates.assignmentEnd]
  );

  const responseA = await request("GET", "/contractor/projects", undefined, contractorA.token);
  assert.equal(responseA.response.status, 200);
  assert.equal(responseA.data.length, 2, "ACTIVE and RELEASED assignments must both remain visible");
  assert.equal(responseA.data.some((row) => row.id === otherProject.id), false, "another contractor's project must not leak");

  const released = responseA.data.find((row) => row.id === releasedProject.id);
  assert.deepEqual({
    project_start_date: released.project_start_date,
    project_end_date: released.project_end_date,
    assignment_start_date: released.assignment_start_date,
    assignment_end_date: released.assignment_end_date,
    project_status: released.project_status,
    assignment_status: released.assignment_status,
    assignment_released_at: released.assignment_released_at,
  }, {
    project_start_date: releasedDates.projectStart,
    project_end_date: releasedDates.projectEnd,
    assignment_start_date: releasedDates.assignmentStart,
    assignment_end_date: releasedDates.assignmentEnd,
    project_status: "COMPLETED",
    assignment_status: "RELEASED",
    assignment_released_at: "2026-02-16 09:30:00",
  });
  assert.equal(Object.hasOwn(released, "start_date"), false);
  assert.equal(Object.hasOwn(released, "end_date"), false);
  assert.equal(Object.hasOwn(released, "status"), false);
  assert.equal(Object.hasOwn(released, "released_at"), false);

  const active = responseA.data.find((row) => row.id === activeProject.id);
  assert.equal(active.project_status, "ACTIVE");
  assert.equal(active.assignment_status, "ACTIVE");

  const responseB = await request("GET", "/contractor/projects", undefined, contractorB.token);
  assert.equal(responseB.response.status, 200);
  assert.deepEqual(responseB.data.map((row) => row.id), [otherProject.id]);
});
