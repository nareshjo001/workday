process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m01-test-only-secret";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server;
let baseUrl;

function runRegression(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "../../", file)], {
      env: { ...process.env, API_BASE_URL: baseUrl },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with status ${code}`));
    });
  });
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test("current MVP regression preserves allocation, billing, invoice, and concurrency behavior", { timeout: 120000 }, async () => {
  await runRegression("mvp_fix_test.js");
  assert.ok(true);
});

test("released contractor eligibility regression remains covered", { timeout: 60000 }, async () => {
  await runRegression("eligible_contractor_release_test.js");
  assert.ok(true);
});
