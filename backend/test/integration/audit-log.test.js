process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m04-test-only-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
const auditRepository = require("../../src/repositories/auditRepository");

let server;
let baseUrl;

async function request(method, pathname, body, token, requestId) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (requestId) headers["X-Request-Id"] = requestId;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data; try { data = await response.json(); } catch { data = null; }
  return { response, data };
}

function runRegression(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "../../", file)], {
      env: { ...process.env, API_BASE_URL: baseUrl }, stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} exited with status ${code}`)));
  });
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M04 audit rows cover critical mutations, retain correlation, redact secrets, and roll back with the mutation", { timeout: 120000 }, async () => {
  const signup = await request("POST", "/auth/signup", {
    name: "M04 PM", email: "m04-pm@test.example", password: "Password123!", role: "PM", companyName: "M04 Company",
  });
  assert.equal(signup.response.status, 201);
  const login = await request("POST", "/auth/login", { email: "m04-pm@test.example", password: "Password123!" });
  assert.equal(login.response.status, 200);

  const originalAppend = auditRepository.append;
  auditRepository.append = async () => { throw new Error("forced audit insert failure"); };
  try {
    const failed = await request("POST", "/pm/projects", {
      name: "must roll back", description: "audit failure", start_date: "2027-01-01", expected_hours: 8,
      requirements: [{ skill: "BACKEND", required_count: 1 }],
    }, login.data.token, "m04_rollback_project");
    assert.equal(failed.response.status, 500, JSON.stringify(failed.data));
  } finally {
    auditRepository.append = originalAppend;
  }
  const [failedProjects] = await pool.query("SELECT id FROM projects WHERE name = 'must roll back'");
  assert.equal(failedProjects.length, 0, "audit failure must roll back the project transaction");

  const success = await request("POST", "/pm/projects", {
    name: "one audited project", description: "audit success", start_date: "2027-01-02", expected_hours: 8,
    requirements: [{ skill: "BACKEND", required_count: 1 }],
  }, login.data.token, "m04_exactly_once_project");
  assert.equal(success.response.status, 201);
  const [projectAudit] = await pool.query(
    "SELECT before_json, after_json FROM audit_log WHERE request_id = 'm04_exactly_once_project'"
  );
  assert.equal(projectAudit.length, 1, "a successful mutation creates exactly one audit row");
  assert.equal(projectAudit[0].before_json, null);
  const projectSnapshot = typeof projectAudit[0].after_json === "string" ? JSON.parse(projectAudit[0].after_json) : projectAudit[0].after_json;
  assert.equal(projectSnapshot.status, "ACTIVE");

  await runRegression("mvp_fix_test.js");
  const [rows] = await pool.query(
    "SELECT actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json, request_id, created_at FROM audit_log ORDER BY id"
  );
  const actions = new Set(rows.map((row) => row.action));
  for (const action of [
    "CONTRACTOR_CREATED", "PROJECT_CREATED", "ASSIGNMENT_CREATED", "ASSIGNMENT_ALLOCATION_CHANGED",
    "MILESTONE_CREATED", "TIMESHEET_SUBMITTED", "TIMESHEET_REVIEWED", "MILESTONE_MET",
    "INVOICE_REVIEWED", "PROJECT_COMPLETED",
  ]) assert.ok(actions.has(action), `missing audit action ${action}`);
  assert.ok(rows.every((row) => row.actor_user_id && row.actor_role && row.entity_type && row.entity_id && row.request_id && row.created_at));
  const serialized = JSON.stringify(rows).toLowerCase();
  for (const forbidden of ["password_hash", "refresh_token", "authorization", "set-cookie", "reset_token"]) {
    assert.equal(serialized.includes(forbidden), false, `audit payload leaked ${forbidden}`);
  }
  const review = rows.find((row) => row.action === "TIMESHEET_REVIEWED");
  const asObject = (value) => typeof value === "string" ? JSON.parse(value) : value;
  assert.equal(asObject(review.before_json).status, "SUBMITTED");
  assert.ok(["APPROVED", "REJECTED"].includes(asObject(review.after_json).status));
});
