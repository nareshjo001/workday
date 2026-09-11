process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m25-test-only-secret";
process.env.M09_ENFORCE_ACCESS = "true";
process.env.INTELLIGENCE_VENDOR_RATE_ENABLED = "true";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const { pool } = require("../../src/config/db");
const app = require("../../src/app");
const env = require("../../src/config/env");
const { comparableStatistics, percentile } = require("../../src/utils/percentiles");

let server; let baseUrl; let sequence = 0; const state = {};
const date = (offset) => { const value = new Date(); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
const email = (label) => `m25-${label}-${Date.now()}-${++sequence}@test.example`;
async function request(method, path, body, token) { const response = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, data: await response.json().catch(() => null) }; }
async function signup(role, label) { const address = email(label); const password = "Password123!"; const body = { name: `M25 ${label}`, email: address, password, role }; if (role === "PM") body.companyName = `M25 ${label} Company`; assert.equal((await request("POST", "/auth/signup", body)).status, 201); const login = await request("POST", "/auth/login", { email: address, password }); assert.equal(login.status, 200); return { token: login.data.token, id: login.data.user.id }; }
async function addContractor(label) { const address = email(label); const result = await request("POST", "/vendor/contractors", { name: `M25 ${label}`, email: address, password: "Password123!", hourly_rate: 100 }, state.vendor.token); assert.equal(result.status, 201, JSON.stringify(result.data)); return { id: result.data.id, email: address }; }

before(async () => {
  await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  state.pm = await signup("PM", "pm"); state.vendor = await signup("VENDOR", "vendor"); state.otherVendor = await signup("VENDOR", "other-vendor");
  const project = await request("POST", "/pm/projects", { name: "M25 Target", start_date: date(0), end_date: date(30), expected_hours: 100, requirements: [{ skill: "FRONTEND", required_count: 5 }] }, state.pm.token);
  assert.equal(project.status, 201, JSON.stringify(project.data)); state.project = project.data; state.requirement = project.data.requirements[0];
  await pool.query("UPDATE projects SET currency='INR' WHERE id=?", [state.project.id]);
  assert.equal((await request("POST", "/pm/vendor-access", { vendorId: state.vendor.id, projectId: state.project.id }, state.pm.token)).status, 201);
  const historicalProject = await request("POST", "/pm/projects", { name: "M25 History", start_date: date(0), end_date: date(30), expected_hours: 100, requirements: [{ skill: "FRONTEND", required_count: 5 }] }, state.pm.token);
  assert.equal(historicalProject.status, 201); state.historyProject = historicalProject.data; state.historyRequirement = historicalProject.data.requirements[0]; await pool.query("UPDATE projects SET currency='INR' WHERE id=?", [state.historyProject.id]);
  assert.equal((await request("POST", "/pm/vendor-access", { vendorId: state.vendor.id, projectId: state.historyProject.id }, state.pm.token)).status, 201);
  state.current = await addContractor("current");
  const currentLogin = await request("POST", "/auth/login", { email: state.current.email, password: "Password123!" }); assert.equal(currentLogin.status, 200); state.contractorToken = currentLogin.data.token;
  assert.equal((await request("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, state.contractorToken)).status, 200);
  const historical = [await addContractor("history-1"), await addContractor("history-2"), await addContractor("history-3")];
  for (const [index, contractor] of historical.entries()) await pool.query("INSERT INTO project_assignments (contractor_id,project_id,requirement_id,bill_rate_snapshot,cost_rate_snapshot,currency,assigned_date,start_date,status) VALUES (?,?,?,?,?,?,CURDATE(),CURDATE(),'RELEASED')", [contractor.id, state.historyProject.id, state.historyRequirement.id, [120, 140, 160][index], 100, "INR"]);
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M25 deterministic percentile interpolation handles odd and even samples", () => {
  assert.equal(percentile([100, 200, 300, 400], 0.25), 175);
  assert.deepEqual(comparableStatistics([100, 200, 300]), { sample_size: 3, minimum: 100, p25: 150, median: 200, p75: 250, maximum: 300 });
});

test("M25 enforces feature, role, tenancy, and read-only boundaries", async () => {
  const body = { contractorId: state.current.id, projectId: state.project.id, requirementId: state.requirement.id, proposedBillRate: 150 };
  const before = await pool.query("SELECT COUNT(*) count FROM project_assignments");
  env.intelligence.vendorRateIntelligence = false;
  assert.equal((await request("POST", "/vendor/rate-intelligence/analyze", body, state.vendor.token)).status, 404);
  env.intelligence.vendorRateIntelligence = true;
  assert.equal((await request("POST", "/vendor/rate-intelligence/analyze", body)).status, 401);
  assert.equal((await request("POST", "/vendor/rate-intelligence/analyze", body, state.pm.token)).status, 403);
  assert.equal((await request("POST", "/vendor/rate-intelligence/analyze", body, state.contractorToken)).status, 403);
  assert.equal((await request("POST", "/vendor/rate-intelligence/analyze", { ...body, contractorId: (await addContractor("other-owned")).id }, state.otherVendor.token)).status, 404);
  const afterRows = await pool.query("SELECT COUNT(*) count FROM project_assignments"); assert.equal(afterRows[0][0].count, before[0][0].count);
});

test("M25 uses immutable same-Vendor, same-skill, same-currency historical snapshots and server-side cost", async () => {
  const result = await request("POST", "/vendor/rate-intelligence/analyze", { contractorId: state.current.id, projectId: state.project.id, requirementId: state.requirement.id, proposedBillRate: 90, costRate: 1 }, state.vendor.token);
  assert.equal(result.status, 400, "unexpected client cost fields are rejected");
  const analysis = await request("POST", "/vendor/rate-intelligence/analyze", { contractorId: state.current.id, projectId: state.project.id, requirementId: state.requirement.id, proposedBillRate: 140 }, state.vendor.token);
  assert.equal(analysis.status, 200, JSON.stringify(analysis.data));
  assert.equal(analysis.data.context.currency, "INR"); assert.equal(analysis.data.cost.rate, 100);
  assert.deepEqual(analysis.data.comparables, { scope: "VENDOR_SKILL_CLIENT", sample_size: 3, minimum: 120, p25: 130, median: 140, p75: 150, maximum: 160 });
  assert.deepEqual(analysis.data.recommendation, { status: "AVAILABLE", lower: 130, suggested: 140, upper: 150, basis: "INTERNAL_HISTORICAL_COMPARABLES" });
  assert.deepEqual(analysis.data.proposed_rate, { rate: 140, margin_per_hour: 40, margin_percentage: 28.57 });
  assert.ok(analysis.data.findings.some((item) => item.code === "PROPOSED_RATE_WITHIN_COMPARABLE_RANGE"));
  const below = await request("POST", "/vendor/rate-intelligence/analyze", { contractorId: state.current.id, projectId: state.project.id, requirementId: state.requirement.id, proposedBillRate: 90 }, state.vendor.token);
  assert.ok(below.data.findings.some((item) => item.code === "PROPOSED_RATE_BELOW_COST" && item.severity === "HIGH"));
});

test("M25 retains Vendor-owned historical evidence after Client access is revoked, without restoring new access", async () => {
  const targetPm = await signup("PM", "target-pm");
  const target = await request("POST", "/pm/projects", { name: "M25 Active Target", start_date: date(0), end_date: date(30), expected_hours: 100, requirements: [{ skill: "FRONTEND", required_count: 2 }] }, targetPm.token);
  assert.equal(target.status, 201); const targetRequirement = target.data.requirements[0];
  await pool.query("UPDATE projects SET currency='INR' WHERE id=?", [target.data.id]);
  assert.equal((await request("POST", "/pm/vendor-access", { vendorId: state.vendor.id, projectId: target.data.id }, targetPm.token)).status, 201);
  const targetHistory = await addContractor("target-history");
  await pool.query("INSERT INTO project_assignments (contractor_id,project_id,requirement_id,bill_rate_snapshot,cost_rate_snapshot,currency,assigned_date,start_date,status) VALUES (?,?,?,?,?,?,CURDATE(),CURDATE(),'RELEASED')", [targetHistory.id, target.data.id, targetRequirement.id, 180, 100, "INR"]);
  const [historyAssignments] = await pool.query("SELECT id FROM project_assignments WHERE project_id=? ORDER BY id ASC", [state.historyProject.id]);
  await pool.query("DELETE FROM project_assignments WHERE id=?", [historyAssignments[0].id]);
  await pool.query("UPDATE project_vendors SET status='REVOKED' WHERE project_id=? AND vendor_id=?", [state.historyProject.id, state.vendor.id]);
  await pool.query("UPDATE client_vendor_relationships SET status='REVOKED' WHERE client_company_id=(SELECT company_id FROM project_managers WHERE user_id=?) AND vendor_id=?", [state.pm.id, state.vendor.id]);
  assert.equal((await request("GET", `/vendor/projects/${state.historyProject.id}/requirements`, undefined, state.vendor.token)).status, 404, "revoked Client A cannot receive new Vendor activity");
  const analysis = await request("POST", "/vendor/rate-intelligence/analyze", { contractorId: state.current.id, projectId: target.data.id, requirementId: targetRequirement.id, proposedBillRate: 150 }, state.vendor.token);
  assert.equal(analysis.status, 200, JSON.stringify(analysis.data));
  assert.deepEqual(analysis.data.comparables, { scope: "VENDOR_SKILL_CURRENCY", sample_size: 3, minimum: 140, p25: 150, median: 160, p75: 170, maximum: 180 });
});
