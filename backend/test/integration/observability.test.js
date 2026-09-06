process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m03-test-only-secret";

const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");
const logger = require("../../src/observability/logger");
const metrics = require("../../src/observability/metrics");

let server; let baseUrl;
async function request(path, options = {}) { const response = await fetch(`${baseUrl}${path}`, options); let body; try { body = await response.json(); } catch { body = null; } return { response, body }; }
before(async () => { await resetTestDatabase(); metrics.reset(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M03 supplies request IDs, stable error contracts, health semantics, and safe observability", async () => {
  const health = await request("/health/live", { headers: { "X-Request-Id": "trace_M03_123" } });
  assert.equal(health.response.status, 200); assert.equal(health.response.headers.get("x-request-id"), "trace_M03_123"); assert.equal(health.body.status, "live");
  const ready = await request("/health/ready"); assert.equal(ready.response.status, 200); assert.equal(ready.body.dependencies.database, "ready");
  const invalid = await request("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "not-an-email", password: "secret-password" }) });
  assert.equal(invalid.response.status, 400); assert.equal(invalid.body.code, "VALIDATION_ERROR"); assert.ok(invalid.body.request_id); assert.ok(Array.isArray(invalid.body.details)); assert.equal(JSON.stringify(invalid.body).includes("secret-password"), false);
  const missing = await request("/not-real"); assert.equal(missing.response.status, 404); assert.equal(missing.body.code, "ROUTE_NOT_FOUND"); assert.ok(missing.body.request_id);
  assert.deepEqual(logger.redact({ password: "secret", token: "raw", actor: "safe" }), { password: "[REDACTED]", token: "[REDACTED]", actor: "safe" });
  assert.ok(metrics.snapshot().latency_ms.http_request.count >= 4);
});
