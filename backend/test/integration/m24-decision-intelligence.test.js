process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m24-test-only-secret";
process.env.INTELLIGENCE_VENDOR_RATE_ENABLED = "false";
process.env.INTELLIGENCE_PM_PROJECT_CONTROL_ENABLED = "false";
process.env.INTELLIGENCE_CONTRACTOR_TIMESHEET_ENABLED = "false";
process.env.INTELLIGENCE_AI_EXPLANATIONS_ENABLED = "false";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const { pool } = require("../../src/config/db");
const app = require("../../src/app");
const env = require("../../src/config/env");
const { createFinding } = require("../../src/utils/intelligenceFinding");
const { explainFinding } = require("../../src/services/intelligenceExplanationService");

let server;
let baseUrl;

async function request(method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function signup(role, label) {
  const email = `m24-${label}-${Date.now()}@test.example`;
  const password = "Password123!";
  const payload = { name: `M24 ${label}`, email, password, role };
  if (role === "PM") payload.companyName = `M24 ${label} Company`;
  const created = await request("POST", "/auth/signup", payload);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const loggedIn = await request("POST", "/auth/login", { email, password });
  assert.equal(loggedIn.status, 200, JSON.stringify(loggedIn.data));
  return { token: loggedIn.data.token, id: loggedIn.data.user.id };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("M24 finding contract validates deterministic, safe findings", () => {
  const finding = createFinding({
    code: "RATE_ABOVE_HISTORICAL_RANGE", severity: "medium", title: "Rate is above recent comparable assignments",
    summary: "The proposed rate is 8.4% above the recent comparable median.",
    evidence: [{ key: "proposed_rate", label: "Proposed rate", value: 1500, unit: "INR/hour" }, { key: "historical_median", label: "Historical median", value: 1380 }],
    recommended_action: "Review the proposed rate before submission", source: { engine: "vendor_rate_intelligence", version: 1 },
  });
  assert.equal(finding.severity, "MEDIUM");
  assert.equal(finding.source.version, "1");
  assert.throws(() => createFinding({ ...finding, severity: "URGENT" }), /missing or invalid/i);
  assert.throws(() => createFinding({ ...finding, code: "not stable" }), /missing or invalid/i);
  assert.throws(() => createFinding({ ...finding, title: "" }), /missing or invalid/i);
  assert.throws(() => createFinding({ ...finding, evidence: [{ key: "unsafe", label: "Unsafe", value: { raw: "row" } }] }), /evidence/i);
  assert.throws(() => createFinding({ ...finding, evidence: [{ key: "nan", label: "NaN", value: Number.NaN }] }), /evidence/i);
});

test("M24 explanation fallback returns the authoritative deterministic summary", () => {
  const finding = createFinding({
    code: "EXAMPLE", severity: "INFO", title: "Example", summary: "Deterministic calculation is available.", evidence: [],
    recommended_action: "Review the evidence.", source: { engine: "test", version: "1" },
  });
  assert.equal(explainFinding(finding, { tenantId: "not-used-by-fallback" }), finding.summary);
});

test("M24 capability discovery is authenticated, role-aware, configuration-driven, and ignores client role hints", async () => {
  const vendor = await signup("VENDOR", "vendor");
  const pm = await signup("PM", "pm");
  const contractorEmail = `m24-contractor-${Date.now()}@test.example`;
  const createdContractor = await request("POST", "/vendor/contractors", { name: "M24 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 100 }, vendor.token);
  assert.equal(createdContractor.status, 201, JSON.stringify(createdContractor.data));
  const contractorLogin = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" });
  assert.equal(contractorLogin.status, 200);

  const unauthenticated = await request("GET", "/intelligence/capabilities");
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.data.code, "UNAUTHORIZED");

  const vendorCapabilities = await request("GET", "/intelligence/capabilities?role=PM&userId=999", undefined, vendor.token);
  assert.equal(vendorCapabilities.status, 200);
  assert.deepEqual(vendorCapabilities.data, { intelligence_contract_version: "1", capabilities: { vendor_rate_intelligence: false, pm_project_control: false, contractor_timesheet_intelligence: false, ai_explanations: false } });
  const pmCapabilities = await request("GET", "/intelligence/capabilities", undefined, pm.token);
  assert.equal(pmCapabilities.data.capabilities.vendor_rate_intelligence, false);
  assert.equal(pmCapabilities.data.capabilities.pm_project_control, false);
  const contractorCapabilities = await request("GET", "/intelligence/capabilities", undefined, contractorLogin.data.token);
  assert.equal(contractorCapabilities.data.capabilities.vendor_rate_intelligence, false);
  assert.equal(contractorCapabilities.data.capabilities.pm_project_control, false);
  assert.equal(contractorCapabilities.data.capabilities.contractor_timesheet_intelligence, false);

  env.intelligence.vendorRateIntelligence = true;
  env.intelligence.aiExplanations = true;
  const configuredVendor = await request("GET", "/intelligence/capabilities", undefined, vendor.token);
  const configuredPm = await request("GET", "/intelligence/capabilities", undefined, pm.token);
  assert.equal(configuredVendor.data.capabilities.vendor_rate_intelligence, true);
  assert.equal(configuredVendor.data.capabilities.ai_explanations, true);
  assert.equal(configuredPm.data.capabilities.vendor_rate_intelligence, false, "a PM cannot acquire a Vendor capability through configuration or request parameters");
  env.intelligence.vendorRateIntelligence = false;
  env.intelligence.aiExplanations = false;
});
