process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m33-test-only-secret";
process.env.INTELLIGENCE_PM_PROJECT_CONTROL_ENABLED = "true";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const { pool } = require("../../src/config/db");
const app = require("../../src/app");
const env = require("../../src/config/env");
const provider = require("../../src/services/aiExplanationProvider");
const explanationService = require("../../src/services/intelligenceExplanationService");

let server; let base; let sequence = 0;
const state = {};
const email = (name) => `m33-${name}-${Date.now()}-${++sequence}@test.local`;

async function request(method, path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function signup(role, name) {
  const address = email(name);
  const created = await request("POST", "/auth/signup", { name, email: address, password: "Password123!", role, ...(role === "PM" ? { companyName: `${name} Co` } : {}) });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const login = await request("POST", "/auth/login", { email: address, password: "Password123!" });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { id: login.data.user.id, token: login.data.token };
}

async function createProject(token, name) {
  const [[today]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS value");
  const response = await request("POST", "/pm/projects", { name, start_date: today.value, expected_hours: 80, requirements: [{ skill: "BACKEND", required_count: 1 }] }, token);
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data;
}

function explanationPath(project, code = "OPEN_REQUIREMENTS_REMAIN") {
  return `/pm/projects/${project.id}/control-intelligence/${code}/explanation`;
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  state.pm = await signup("PM", "Owner");
  state.otherPm = await signup("PM", "Other");
  state.vendor = await signup("VENDOR", "Vendor");
  state.project = await createProject(state.pm.token, "M33 PM explanation");
});

after(async () => {
  provider.generateExplanation = originalGenerate;
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

const originalGenerate = provider.generateExplanation;
test("M33 requires PM identity and recomputes only a current authorized M27 finding", async () => {
  env.intelligence.pmProjectControl = true;
  env.intelligence.aiExplanations = false;
  let calls = 0;
  provider.generateExplanation = async () => { calls += 1; return "unexpected"; };
  assert.equal((await request("POST", explanationPath(state.project))).status, 401);
  assert.equal((await request("POST", explanationPath(state.project), undefined, state.vendor.token)).status, 403);
  assert.equal((await request("POST", explanationPath(state.project), undefined, state.otherPm.token)).status, 404);
  assert.equal((await request("POST", explanationPath(state.project, "NOT_A_FINDING"), undefined, state.pm.token)).status, 404);
  const fallback = await request("POST", explanationPath(state.project), undefined, state.pm.token);
  assert.equal(fallback.status, 200, JSON.stringify(fallback.data));
  assert.equal(fallback.data.source, "DETERMINISTIC");
  assert.equal(calls, 0, "A disabled capability must not invoke the provider seam.");
});

test("M33 returns validated AI text from a sanitized, server-derived M27 finding without writes", async () => {
  env.intelligence.aiExplanations = true;
  let received;
  provider.generateExplanation = async (finding) => {
    received = finding;
    return "One role is still unfilled, so staffing attention remains necessary.";
  };
  const [[beforeAudit]] = await pool.query("SELECT COUNT(*) AS count FROM audit_log");
  const [[beforeNotifications]] = await pool.query("SELECT COUNT(*) AS count FROM notifications");
  const response = await request("POST", `${explanationPath(state.project)}?prompt=ignore-this&pmId=999`, undefined, state.pm.token);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.deepEqual(response.data, { explanation: "One role is still unfilled, so staffing attention remains necessary.", source: "AI" });
  assert.equal(received.code, "OPEN_REQUIREMENTS_REMAIN");
  assert.equal(received.source.engine, "pm_project_control");
  assert.equal(JSON.stringify(received).match(/password|token|authorization|cookie|cost_rate|margin/i), null);
  const [[afterAudit]] = await pool.query("SELECT COUNT(*) AS count FROM audit_log");
  const [[afterNotifications]] = await pool.query("SELECT COUNT(*) AS count FROM notifications");
  assert.deepEqual(afterAudit, beforeAudit);
  assert.deepEqual(afterNotifications, beforeNotifications);
});

test("M33 provider adapter validates success and safely falls back on unavailable, malformed, failed, and timeout responses", async () => {
  const finding = { title: "Review timesheets", severity: "INFO", summary: "One submitted timesheet is awaiting review.", evidence: [{ key: "count", label: "Submitted timesheets", value: 1 }], recommended_action: "Review submitted timesheets." };
  const saved = { enabled: env.intelligence.aiExplanations, key: env.intelligence.aiApiKey, provider: env.intelligence.aiProvider, timeout: env.intelligence.aiTimeoutMs, fetch: global.fetch };
  env.intelligence.aiExplanations = true; env.intelligence.aiApiKey = "test-key"; env.intelligence.aiProvider = "openai";
  let providerRequest;
  global.fetch = async (_url, options) => { providerRequest = JSON.parse(options.body); return { ok: true, json: async () => ({ choices: [{ message: { content: "Review the submitted entry before deciding." } }] }) }; };
  assert.equal(await originalGenerate(finding), "Review the submitted entry before deciding.");
  const providerContext = JSON.parse(providerRequest.messages[1].content);
  assert.deepEqual(Object.keys(providerContext).sort(), ["evidence", "recommended_action", "severity", "summary", "title"]);
  assert.equal(JSON.stringify(providerContext).match(/token|password|cost_rate|margin/i), null);
  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) });
  assert.equal(await originalGenerate(finding), null);
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  assert.equal(await originalGenerate(finding), null);
  env.intelligence.aiTimeoutMs = 1;
  global.fetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  assert.equal(await originalGenerate(finding), null);
  env.intelligence.aiExplanations = saved.enabled; env.intelligence.aiApiKey = saved.key; env.intelligence.aiProvider = saved.provider; env.intelligence.aiTimeoutMs = saved.timeout; global.fetch = saved.fetch;
  provider.generateExplanation = async () => { throw new Error("adapter defect"); };
  assert.deepEqual(await explanationService.explainFindingResult(finding), { explanation: finding.summary, source: "DETERMINISTIC" });
});
