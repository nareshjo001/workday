process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m07-test-secret";
const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
let server; let base; let serial = 0;
const email = (kind) => `m07-${kind}-${Date.now()}-${++serial}@test.example`;
async function request(method, path, body, token) { const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { response, data: await response.json() }; }
async function signup(role) { const value = email(role); const password = "Password123!"; await request("POST", "/auth/signup", { name: role, email: value, password, role, ...(role === "PM" ? { companyName: "M07 Co" } : {}) }); return (await request("POST", "/auth/login", { email: value, password })).data.token; }
before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M07 supports multi-skill profile updates, prevents duplicates, audits changes, and uses any active skill for eligibility", async () => {
  const vendor = await signup("VENDOR"); const pm = await signup("PM"); const contractorEmail = email("contractor");
  const created = await request("POST", "/vendor/contractors", { name: "M07 Contractor", email: contractorEmail, password: "Password123!", hourly_rate: 80 }, vendor); assert.equal(created.response.status, 201);
  const contractor = (await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" })).data.token;
  const profile = { phone: "+91 9000000000", headline: "Platform engineer", total_experience_years: 6.5, skills: [{ code: "BACKEND", proficiency: "EXPERT", years_experience: 5, is_primary: true }, { code: "DEVOPS", proficiency: "ADVANCED", years_experience: 3, is_primary: false }] };
  const updated = await request("PATCH", "/contractor/profile", profile, contractor); assert.equal(updated.response.status, 200); assert.equal(updated.data.skills.length, 2); assert.equal(updated.data.skills[0].code, "BACKEND");
  assert.equal((await request("PATCH", "/contractor/profile", { skills: [{ code: "BACKEND", proficiency: "EXPERT", years_experience: 1, is_primary: true }, { code: "BACKEND", proficiency: "ADVANCED", years_experience: 1, is_primary: false }] }, contractor)).response.status, 400);
  const project = await request("POST", "/pm/projects", { name: "M07 DevOps project", start_date: new Date().toISOString().slice(0, 10), expected_hours: 8, requirements: [{ skill: "DEVOPS", required_count: 1 }] }, pm); assert.equal(project.response.status, 201);
  const eligible = await request("GET", `/vendor/projects/${project.data.id}/requirements/${project.data.requirements[0].id}/eligible-contractors`, undefined, vendor); assert.equal(eligible.response.status, 200); assert.equal(eligible.data.eligible_contractors.some((row) => row.id === created.data.id), true);
  assert.equal((await request("GET", "/contractor/profile", undefined, vendor)).response.status, 403);
  const [audit] = await pool.query("SELECT action FROM audit_log WHERE entity_id = ? AND action = 'CONTRACTOR_PROFILE_UPDATED'", [created.data.id]); assert.equal(audit.length, 1);
});
