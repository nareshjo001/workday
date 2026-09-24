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

  // 1. Create Contractor 1
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

  // 2. Create Contractor 2 (for cross-contractor isolation check)
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

  // 3. Create Project 1 and Project 2 in test DB
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

  // Insert active assignments directly
  await pool.query(
    "INSERT INTO project_assignments (contractor_id, project_id, status, allocated_hours, assigned_date, start_date) VALUES (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01'), (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01'), (?, ?, 'ACTIVE', 500, '2026-06-01', '2026-06-01')",
    [c1Id, p1Id, c1Id, p2Id, c2Id, p1Id]
  );

  // 4. Seed Contractor 1 timesheet entries across 7 distinct calendar weeks:
  // Week 7 (Aug 17 - Aug 23, 2026): records on Project 1 and Project 2 (Cross-project test)
  const d7a = await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-17", hoursLogged: 5, description: "W7 P1 Day 1" }, c1Token);
  assert.equal(d7a.response.status, 201);
  const d7b = await request("POST", "/contractor/timesheets", { projectId: p2Id, workDate: "2026-08-18", hoursLogged: 4, description: "W7 P2 Day 2" }, c1Token);
  assert.equal(d7b.response.status, 201);

  // Week 6 (Aug 10 - Aug 16, 2026):
  const d6 = await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-10", hoursLogged: 6, description: "W6 P1" }, c1Token);
  assert.equal(d6.response.status, 201);

  // Week 5 (Aug 03 - Aug 09, 2026): Week with 6 daily records (Never split test)
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-03", hoursLogged: 7, description: "W5 Mon" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-04", hoursLogged: 7, description: "W5 Tue" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-05", hoursLogged: 7, description: "W5 Wed" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-06", hoursLogged: 7, description: "W5 Thu" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-07", hoursLogged: 7, description: "W5 Fri" }, c1Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-08", hoursLogged: 4, description: "W5 Sat" }, c1Token);

  // Week 4 (Jul 27 - Aug 02, 2026):
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-27", hoursLogged: 8, description: "W4" }, c1Token);

  // Week 3 (Jul 20 - Jul 26, 2026):
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-20", hoursLogged: 8, description: "W3" }, c1Token);

  // Week 2 (Jul 13 - Jul 19, 2026):
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-13", hoursLogged: 8, description: "W2" }, c1Token);

  // Week 1 (Jul 06 - Jul 12, 2026):
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-06", hoursLogged: 8, description: "W1" }, c1Token);

  // 5. Seed Contractor 2 entries in Week 7 and Week 1
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-08-17", hoursLogged: 8, description: "C2 W7" }, c2Token);
  await request("POST", "/contractor/timesheets", { projectId: p1Id, workDate: "2026-07-06", hoursLogged: 8, description: "C2 W1" }, c2Token);

  // =========================================================================
  // TEST A & B: Page 1 returns newest 5 distinct weeks, total_weeks=7, total_pages=2
  // =========================================================================
  const page1 = await request("GET", "/contractor/timesheets?page=1&pageSize=5", undefined, c1Token);
  assert.equal(page1.response.status, 200);
  assert.equal(page1.data.page, 1);
  assert.equal(page1.data.page_size, 5);
  assert.equal(page1.data.total_weeks, 7);
  assert.strictEqual(page1.data.total, undefined, "generic 'total' field must be removed in favor of total_weeks");
  assert.equal(page1.data.total_pages, 2);

  // Check the work dates on Page 1: should only span weeks starting 2026-08-17, 2026-08-10, 2026-08-03, 2026-07-27, 2026-07-20
  const p1Dates = page1.data.items.map((i) => i.work_date);
  assert.ok(p1Dates.includes("2026-08-17")); // Week 7 Project 1
  assert.ok(p1Dates.includes("2026-08-18")); // Week 7 Project 2
  assert.ok(p1Dates.includes("2026-08-10")); // Week 6
  assert.ok(p1Dates.includes("2026-08-03")); // Week 5 Mon
  assert.ok(p1Dates.includes("2026-08-08")); // Week 5 Sat
  assert.ok(p1Dates.includes("2026-07-27")); // Week 4
  assert.ok(p1Dates.includes("2026-07-20")); // Week 3

  // Older weeks (Week 2: 2026-07-13, Week 1: 2026-07-06) must NOT be on Page 1
  assert.ok(!p1Dates.includes("2026-07-13"));
  assert.ok(!p1Dates.includes("2026-07-06"));

  // TEST D: Week 5 containing 6 records is NEVER split (all 6 records present)
  const week5Rows = page1.data.items.filter((i) => i.work_date >= "2026-08-03" && i.work_date <= "2026-08-09");
  assert.equal(week5Rows.length, 6, "All 6 records of Week 5 must be present on page 1");

  // TEST E: Week 7 has records from Alpha Project and Beta Project, but still counts as ONE week
  const week7Rows = page1.data.items.filter((i) => i.work_date >= "2026-08-17" && i.work_date <= "2026-08-23");
  assert.equal(week7Rows.length, 2);
  const week7ProjectIds = new Set(week7Rows.map((r) => r.project_id));
  assert.equal(week7ProjectIds.size, 2, "Week 7 has records across 2 different projects");

  // =========================================================================
  // TEST C: Page 2 returns the remaining 2 historical weeks
  // =========================================================================
  const page2 = await request("GET", "/contractor/timesheets?page=2&pageSize=5", undefined, c1Token);
  assert.equal(page2.response.status, 200);
  assert.equal(page2.data.page, 2);
  assert.equal(page2.data.page_size, 5);
  assert.equal(page2.data.total_weeks, 7);
  assert.strictEqual(page2.data.total, undefined);
  assert.equal(page2.data.total_pages, 2);

  const p2Dates = page2.data.items.map((i) => i.work_date);
  assert.ok(p2Dates.includes("2026-07-13")); // Week 2
  assert.ok(p2Dates.includes("2026-07-06")); // Week 1
  assert.equal(page2.data.items.length, 2);

  // =========================================================================
  // TEST H: Contractor Isolation
  // =========================================================================
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

  // =========================================================================
  // TEST I: Filter Compatibility (projectId filter)
  // =========================================================================
  const p2Filter = await request("GET", `/contractor/timesheets?projectId=${p2Id}&page=1&pageSize=5`, undefined, c1Token);
  assert.equal(p2Filter.response.status, 200);
  assert.equal(p2Filter.data.total_weeks, 1, "Beta Project only has 1 week with records");
  assert.strictEqual(p2Filter.data.total, undefined);
  assert.equal(p2Filter.data.total_pages, 1);
  assert.equal(p2Filter.data.items.length, 1);
  assert.equal(p2Filter.data.items[0].project_id, p2Id);
  assert.equal(p2Filter.data.items[0].work_date, "2026-08-18");
});
