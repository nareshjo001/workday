process.env.NODE_ENV = "test";
process.env.DB_NAME = "vms_test";
process.env.JWT_SECRET = "m05-test-only-secret";
const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
let server; let base;
async function request(path, token) { const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } }); return { response, data: await response.json() }; }
before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });
test("M05 paginated contractor list validates query shape and preserves vendor SQL scope", async () => {
  const signup = async (name, email) => { const response = await fetch(`${base}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password: "Password123!", role: "VENDOR" }) }); assert.equal(response.status, 201); const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Password123!" }) }); return (await login.json()).token; };
  const first = await signup("M05 A", "m05-a@test.example"); const second = await signup("M05 B", "m05-b@test.example");
  for (const [name, email] of [["Alice", "m05-alice@test.example"], ["Alicia", "m05-alicia@test.example"]]) { const response = await fetch(`${base}/vendor/contractors`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${first}` }, body: JSON.stringify({ name, email, hourly_rate: 10 }) }); assert.equal(response.status, 201); }
  const page = await request("/vendor/contractors?page=1&pageSize=1&search=ali&sort=name&order=asc", first); assert.equal(page.response.status, 200); assert.equal(page.data.total, 2); assert.equal(page.data.items.length, 1); assert.equal(page.data.page_size, 1); assert.equal(page.data.total_pages, 2); assert.equal(page.data.items[0].name, "Alice");
  const defaultPage = await request("/vendor/contractors", first); assert.equal(defaultPage.response.status, 200); assert.equal(defaultPage.data.page, 1); assert.deepEqual(Object.keys(defaultPage.data).sort(), ["items", "page", "page_size", "total", "total_pages"]);
  const other = await request("/vendor/contractors?page=1&pageSize=25&sort=name", second); assert.equal(other.data.total, 0);
  assert.equal((await request("/vendor/contractors?page=0", first)).response.status, 400);
});
