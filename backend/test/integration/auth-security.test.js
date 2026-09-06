process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m02-test-only-secret";

const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
const mailService = require("../../src/services/mailService");

let server; let baseUrl; let vendor;
function cookie(response) { const value = response.headers.getSetCookie?.()[0] || response.headers.get("set-cookie"); return value?.split(";")[0]; }
async function request(method, path, body, token, sessionCookie) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionCookie) headers.Cookie = sessionCookie;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data; try { data = await response.json(); } catch { data = null; }
  return { response, status: response.status, data, cookie: cookie(response) };
}
function actionToken(purpose) { const email = mailService.getOutbox().filter((message) => message.purpose === purpose).at(-1); assert.ok(email, `expected ${purpose} email in deterministic outbox`); return new URL(email.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token"); }

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M02 secure authentication, recovery, and invitation flows", { timeout: 60000 }, async () => {
  const password = "Password123!";
  const signup = await request("POST", "/auth/signup", { name: "M02 Vendor", email: "m02-vendor@test.example", password, role: "VENDOR" });
  assert.equal(signup.status, 201);
  vendor = await request("POST", "/auth/login", { email: "m02-vendor@test.example", password });
  assert.equal(vendor.status, 200); assert.ok(vendor.cookie); assert.equal(vendor.data.refreshToken, undefined);

  // Rotation invalidates the previous cookie and produces a different successor.
  const rotated = await request("POST", "/auth/refresh", undefined, undefined, vendor.cookie);
  assert.equal(rotated.status, 200); assert.ok(rotated.cookie); assert.notEqual(rotated.cookie, vendor.cookie);
  assert.equal((await request("POST", "/auth/refresh", undefined, undefined, vendor.cookie)).status, 401);
  await request("POST", "/auth/logout", undefined, undefined, rotated.cookie);
  assert.equal((await request("POST", "/auth/refresh", undefined, undefined, rotated.cookie)).status, 401);

  // Recovery does not enumerate, stores a hash only, is purpose-scoped and single use.
  mailService.clearOutbox();
  const known = await request("POST", "/auth/forgot-password", { email: "m02-vendor@test.example" });
  const unknown = await request("POST", "/auth/forgot-password", { email: "missing@test.example" });
  assert.equal(known.status, 202); assert.deepEqual(known.data, unknown.data);
  const resetToken = actionToken("PASSWORD_RESET");
  const [tokenRows] = await pool.query("SELECT token_hash FROM auth_action_tokens WHERE purpose='PASSWORD_RESET'");
  assert.ok(tokenRows.every((row) => row.token_hash !== resetToken));
  assert.equal((await request("POST", "/auth/setup-password", { token: resetToken, password })).status, 400);
  assert.equal((await request("POST", "/auth/reset-password", { token: resetToken, password: "NewPassword123!" })).status, 204);
  assert.equal((await request("POST", "/auth/reset-password", { token: resetToken, password })).status, 400);
  await request("POST", "/auth/forgot-password", { email: "m02-vendor@test.example" });
  const expiredToken = actionToken("PASSWORD_RESET");
  await pool.query("UPDATE auth_action_tokens SET expires_at=DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE purpose='PASSWORD_RESET' AND used_at IS NULL");
  assert.equal((await request("POST", "/auth/reset-password", { token: expiredToken, password })).status, 400);
  const relogin = await request("POST", "/auth/login", { email: "m02-vendor@test.example", password: "NewPassword123!" });
  assert.equal(relogin.status, 200);
  await request("POST", "/auth/logout-all", undefined, relogin.data.token, relogin.cookie);
  assert.equal((await request("POST", "/auth/refresh", undefined, undefined, relogin.cookie)).status, 401);
  assert.equal((await request("GET", "/auth/me", undefined, relogin.data.token)).status, 401);
  const activeVendor = await request("POST", "/auth/login", { email: "m02-vendor@test.example", password: "NewPassword123!" });
  assert.equal(activeVendor.status, 200);

  // Production-shaped contractor creation never accepts/returns a password; the invite is one-use.
  mailService.clearOutbox();
  const contractor = await request("POST", "/vendor/contractors", { name: "Invited Contractor", email: "m02-contractor@test.example", hourly_rate: 42 }, activeVendor.data.token);
  assert.equal(contractor.status, 201); assert.equal(Object.hasOwn(contractor.data, "password"), false);
  const inviteToken = actionToken("CONTRACTOR_INVITATION");
  assert.equal((await request("POST", `/vendor/contractors/${contractor.data.id}/resend-invitation`, undefined, activeVendor.data.token)).status, 202);
  const replacementInvite = actionToken("CONTRACTOR_INVITATION");
  assert.equal((await request("POST", "/auth/setup-password", { token: inviteToken, password: "ContractorPassword123!" })).status, 400);
  assert.equal((await request("POST", "/auth/setup-password", { token: replacementInvite, password: "ContractorPassword123!" })).status, 204);
  assert.equal((await request("POST", "/auth/setup-password", { token: replacementInvite, password: "AnotherPassword123!" })).status, 400);
  assert.equal((await request("POST", "/auth/login", { email: "m02-contractor@test.example", password: "ContractorPassword123!" })).status, 200);

  // Failed attempts are generic and lock the known identity after the configured threshold.
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await request("POST", "/auth/login", { email: "m02-contractor@test.example", password: "wrong-password" })).status, 401);
  assert.equal((await request("POST", "/auth/login", { email: "m02-contractor@test.example", password: "ContractorPassword123!" })).status, 401);
});
