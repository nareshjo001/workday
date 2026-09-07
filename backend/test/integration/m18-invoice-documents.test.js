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

function runM18Flow() {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(process.execPath, [path.join(__dirname, "../../mvp_fix_test.js")], { env: { ...process.env, API_BASE_URL: baseUrl }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error(output || `m18 flow exited ${code}`)));
  });
}

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test("M18 numbers, totals, PDF freeze, authorization, and concurrent allocation", { timeout: 120000 }, async () => {
  const output = await runM18Flow();
  assert.match(output, /M18 acceptance checks: derived tax, concurrent numbering, frozen PDF, and authorized download/);
  assert.match(output, /RESULTS: \d+ passed, 0 failed/);
});
