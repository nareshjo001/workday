process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "contractor-week-pagination-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server;
let baseUrl;
let serial = 0;
const unique = (prefix) => `${prefix}-${Date.now()}-${++serial}@test.example`;

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

async function signup(role, email) {
  const password = "Password123!";
  const body = { name: role, email, password, role };
  if (role === "PM") body.companyName = "Week Pagination Test Co";
  const reg = await request("POST", "/auth/signup", body);
  assert.equal(reg.response.status, 201);
  const login = await request("POST", "/auth/login", { email, password });
  assert.equal(login.response.status, 200);
  return { token: login.data.token, password, id: login.data.user?.id };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("Contractor Timesheets authoritative week-wise pagination", { timeout: 60000 }, async () => {
  const pm = await signup("PM", unique("pm"));
  const vendor = await signup("VENDOR", unique("vendor"));

  const contractor1Email = unique("contractor1");
  const c1Res = await request("POST", "/vendor/contractors", {
    name: "Pagination Contractor 1",
    email: contractor1Email,
    password: "Password123!",
    hourly_rate: 65,
  }, vendor.token);
  assert.equal(c1Res.response.status, 201);
  const c1Login = await request("POST", "/auth/login", { email: contractor1Email, password: "Password123!" });
  const c1Token = c1Login.data.token;
  const c1Id = c1Res.data.id;
  await request("PATCH", "/contractor/profile/skill", { skill: "BACKEND" }, c1Token);

  // Use a second contractor to verify pagination cannot expose foreign logs.
  const contractor2Email = unique("contractor2");
  const c2Res = await request("POST", "/vendor/contractors", {
    name: "Pagination Contractor 2",
    email: contractor2Email,
    password: "Password123!",
    hourly_rate: 65,
  }, vendor.token);
  assert.equal(c2Res.response.status, 201);
  const c2Login = await request("POST", "/auth/login", { email: contractor2Email, password: "Password123!" });
  const c2Token = c2Login.data.token;
  const c2Id = c2Res.data.id;
  await request("PATCH", "/contractor/profile/skill", { skill: "BACKEND" }, c2Token);

  const [p1Result] = await pool.query(
    "INSERT INTO projects (name, pm_id, start_date, status, allow_weekend) VALUES ('Alpha Project', ?, '2026-06-01', 'ACTIVE', 1)",
    [pm.id]
  );
  const p1Id = p1Result.insertId;

  const [p2Result] = await pool.query(
    "INSERT INTO projects (name, pm_id, start_date, status, allow_weekend) VALUES ('Beta Project', ?, '2026-06-01', 'ACTIVE', 1)",
    [pm.id]
  );
  const p2Id = p2Result.insertId;

  await pool.query(
    "INSERT INTO project_assignments (contractor_id, project_id, status, allocated_hours, assigned_date, start_date) VALUES (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01'), (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01'), (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01')",
    [c1Id, p1Id, c1Id, p2Id, c2Id, p1Id]
  );

  // Seed seven calendar weeks, including one with records from two projects.
  const d7a = await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-17", hoursLogged: 5, description: "W7 P1 Day 1" }, c1Token);
  assert.equal(d7a.response.status, 201);
  const d7b = await request("POST", "/contractor/timesheets", { projectId: p2Id, workDate: "2026-08-18", hoursLogged: 4, description: "W7 P2 Day 2" }, c1Token);
  assert.equal(d7b.response.status, 201);

  const d6 = await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-10", hoursLogged: 6, description: "W6 P1" }, c1Token);
  assert.equal(d6.response.status, 201);

  // Seed six daily rows in one week to detect pagination that splits a week.
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-03", hoursLogged: 7, description: "W5 Mon" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-04", hoursLogged: 7, description: "W5 Tue" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-05", hoursLogged: 7, description: "W5 Wed" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-06", hoursLogged: 7, description: "W5 Thu" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-07", hoursLogged: 7, description: "W5 Fri" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-08", hoursLogged: 4, description: "W5 Sat" }, c1Token);

  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-27", hoursLogged: 8, description: "W4" }, c1Token);

  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-20", hoursLogged: 8, description: "W3" }, c1Token);

  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-13", hoursLogged: 8, description: "W2" }, c1Token);

  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-06", hoursLogged: 8, description: "W1" }, c1Token);

  // Seed overlapping weeks for another contractor to test isolation.
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-17", hoursLogged: 8, description: "C2 W7" }, c2Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-06", hoursLogged: 8, description: "C2 W1" }, c2Token);

  // Page one must return five complete weeks while reporting seven total weeks.
  const page1 = await request("GET", "/contractor/timesheets?page=1&pageSize=5", undefined, c1Token);
  assert.equal(page1.response.status, 200);
  assert.equal(page1.data.page, 1);
  assert.equal(page1.data.page_size, 5);
  assert.equal(page1.data.total_weeks, 7);
  assert.strictEqual(page1.data.total, undefined, "generic 'total' field must be removed in favor of total_weeks");
  assert.equal(page1.data.total_pages, 2);

  const p1Dates = page1.data.items.map((i) => i.work_date);
  assert.ok(p1Dates.includes("2026-08-17"));
  assert.ok(p1Dates.includes("2026-08-18"));
  assert.ok(p1Dates.includes("2026-08-10"));
  assert.ok(p1Dates.includes("2026-08-03"));
  assert.ok(p1Dates.includes("2026-08-08"));
  assert.ok(p1Dates.includes("2026-07-27"));
  assert.ok(p1Dates.includes("2026-07-20"));

  // Exclude the two older weeks from the first page.
  assert.ok(!p1Dates.includes("2026-07-13"));
  assert.ok(!p1Dates.includes("2026-07-06"));

  // Keep all six daily rows together when paginating by week.
  const week5Rows = page1.data.items.filter((i) => i.work_date >= "2026-08-03" && i.work_date <= "2026-08-09");
  assert.equal(week5Rows.length, 6, "All 6 records of Week 5 must be present on page 1");

  // Count a cross-project calendar week only once.
  const week7Rows = page1.data.items.filter((i) => i.work_date >= "2026-08-17" && i.work_date <= "2026-08-23");
  assert.equal(week7Rows.length, 2);
  const week7ProjectIds = new Set(week7Rows.map((r) => r.project_id));
  assert.equal(week7ProjectIds.size, 2, "Week 7 has records across 2 different projects");

  // Page two must contain the two remaining historical weeks.
  const page2 = await request("GET", "/contractor/timesheets?page=2&pageSize=5", undefined, c1Token);
  assert.equal(page2.response.status, 200);
  assert.equal(page2.data.page, 2);
  assert.equal(page2.data.page_size, 5);
  assert.equal(page2.data.total_weeks, 7);
  assert.strictEqual(page2.data.total, undefined);
  assert.equal(page2.data.total_pages, 2);

  const p2Dates = page2.data.items.map((i) => i.work_date);
  assert.ok(p2Dates.includes("2026-07-13"));
  assert.ok(p2Dates.includes("2026-07-06"));
  assert.equal(page2.data.items.length, 2);

  // Keep each contractor's pagination metadata and rows isolated.
  const c2Timesheets = await request("GET", "/contractor/timesheets?page=1&pageSize=5", undefined, c2Token);
  assert.equal(c2Timesheets.response.status, 200);
  assert.equal(c2Timesheets.data.total_weeks, 2, "Contractor 2 only has 2 distinct weeks");
  assert.strictEqual(c2Timesheets.data.total, undefined);
  assert.equal(c2Timesheets.data.total_pages, 1);
  assert.equal(c2Timesheets.data.items.length, 2);
  const c2Descs = c2Timesheets.data.items.map((r) => r.description);
  assert.ok(c2Descs.includes("C2 W7"));
  assert.ok(c2Descs.includes("C2 W1"));
  assert.ok(!c2Descs.includes("W7 P1 Day 1"));

  const c1Descs = page1.data.items.map((r) => r.description);
  assert.ok(!c1Descs.includes("C2 W7"));
  assert.ok(!c1Descs.includes("C2 W1"));

  // Apply project filters before counting and selecting calendar weeks.
  const p2Filter = await request("GET", `/contractor/timesheets?projectId=${p2Id}&page=1&pageSize=5`, undefined, c1Token);
  assert.equal(p2Filter.response.status, 200);
  assert.equal(p2Filter.data.total_weeks, 1, "Beta Project only has 1 week with records");
  assert.strictEqual(p2Filter.data.total, undefined);
  assert.equal(p2Filter.data.total_pages, 1);
  assert.equal(p2Filter.data.items.length, 1);
  assert.equal(p2Filter.data.items[0].project_id, p2Id);
  assert.equal(p2Filter.data.items[0].work_date, "2026-08-18");
});
