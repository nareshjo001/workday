process.env.NODE_ENV = "test";
process.env.M09_ENFORCE_ACCESS = "true";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = "m09-test";

const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
let server; let base; let sequence = 0;
const email = () => `m09-${Date.now()}-${++sequence}@test.example`;
async function request(method, path, body, token) { const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await response.text(); return { response, data: text ? JSON.parse(text) : null }; }
async function signup(role, companyName) { const value = email(); const password = "Password123!"; const created = await request("POST", "/auth/signup", { name: role, email: value, password, role, ...(role === "PM" ? { companyName: companyName || `M09 Company ${sequence}` } : {}) }); assert.equal(created.response.status, 201); const loggedIn = await request("POST", "/auth/login", { email: value, password }); return { email: value, token: loggedIn.data.token }; }
async function userId(address) { const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [address]); return rows[0].id; }
async function project(pm) { return (await request("POST", "/pm/projects", { name: "Scoped Project", start_date: new Date().toISOString().slice(0, 10), expected_hours: 8, requirements: [{ skill: "BACKEND", required_count: 1 }] }, pm.token)).data; }
before(async () => { await resetTestDatabase(); await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); }); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await pool.end(); });
test("M09 guards PM membership, scopes client data, and preserves history after revocation", async () => {
  const company = "M09 Protected Company"; const pm = await signup("PM", company);
  const attempted = await request("POST", "/auth/signup", { name: "Unauthorized PM", email: email(), password: "Password123!", role: "PM", companyName: company }); assert.equal(attempted.response.status, 403, "existing company cannot be self-claimed");
  const invitedEmail = email(); const invitation = await request("POST", "/pm/company/pm-invitations", { email: invitedEmail }, pm.token); assert.equal(invitation.response.status, 201); assert.ok(invitation.data.token);
  const joined = await request("POST", "/auth/signup", { name: "Invited PM", email: invitedEmail, password: "Password123!", role: "PM", companyName: company, companyInvitationToken: invitation.data.token }); assert.equal(joined.response.status, 201, "valid invitation joins the existing company");
  const vendorA = await signup("VENDOR"); const vendorB = await signup("VENDOR"); const vendorAId = await userId(vendorA.email); const scopedProject = await project(pm);
  assert.equal((await request("GET", `/vendor/projects/${scopedProject.id}/requirements`, undefined, vendorA.token)).response.status, 404);
  assert.equal((await request("POST", "/pm/vendor-access", { vendorId: vendorAId, projectId: scopedProject.id }, pm.token)).response.status, 201);
  assert.equal((await request("GET", `/vendor/projects/${scopedProject.id}/requirements`, undefined, vendorA.token)).response.status, 200);
  assert.equal((await request("GET", `/vendor/projects/${scopedProject.id}/requirements`, undefined, vendorB.token)).response.status, 404, "Vendor B cannot probe Vendor A client/project");
  const contractorEmail = email(); const contractor = await request("POST", "/vendor/contractors", { name: "M09 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 50 }, vendorA.token); const contractorLogin = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" }); await request("PATCH", "/contractor/profile/skill", { skill: "BACKEND" }, contractorLogin.data.token);
  const assigned = await request("POST", `/vendor/projects/${scopedProject.id}/requirements/${scopedProject.requirements[0].id}/assign`, { contractorIds: [contractor.data.id] }, vendorA.token); assert.equal(assigned.response.status, 201);
  const clientDirectory = await request("GET", "/vendor/clients", undefined, vendorA.token); assert.equal(clientDirectory.response.status, 200); assert.equal(clientDirectory.data.items.length, 1); assert.equal(clientDirectory.data.items[0].name, company);
  const detail = await request("GET", `/vendor/clients/${clientDirectory.data.items[0].id}`, undefined, vendorA.token); assert.equal(detail.response.status, 200); assert.equal(detail.data.active_projects.length, 1); assert.equal((await request("GET", `/vendor/clients/${clientDirectory.data.items[0].id}`, undefined, vendorB.token)).response.status, 404);
  assert.equal((await request("DELETE", `/pm/vendor-access/${vendorAId}`, undefined, pm.token)).response.status, 204);
  assert.equal((await request("GET", `/vendor/projects/${scopedProject.id}/requirements`, undefined, vendorA.token)).response.status, 404, "revocation blocks future sourcing"); const [assignments] = await pool.query("SELECT id FROM project_assignments WHERE project_id=?", [scopedProject.id]); assert.equal(assignments.length, 1, "revocation retains historical assignment records"); assert.equal((await request("GET", "/vendor/clients", undefined, vendorA.token)).data.items.length, 0, "directory only includes active relationships");
});
