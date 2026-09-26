const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Load test credentials before app imports so database resets cannot silently use a blank password.
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

let resetQueue = Promise.resolve();

function testConfig() {
  const name = process.env.DB_NAME || "vms_test";
  if (process.env.NODE_ENV !== "test" || !name.endsWith("_test")) {
    throw new Error("Test database reset requires NODE_ENV=test and a database name ending in _test.");
  }
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    name,
  };
}

async function performReset() {
  const config = testConfig();
  if (!config.password) throw new Error("Test database credentials are missing: set DB_PASSWORD in backend/.env; DB_NAME must end in _test.");
  const { name, ...connectionConfig } = config;
  const admin = await mysql.createConnection({ ...connectionConfig, multipleStatements: true });
  const lockName = `workday:${name}:reset`;
  let lockAcquired = false;
  try {
    const [[lock]] = await admin.query("SELECT GET_LOCK(?, 60) AS acquired", [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error(`Timed out waiting to reset test database '${name}'.`);
    lockAcquired = true;
    await admin.query("DROP DATABASE IF EXISTS ??", [config.name]);
    await admin.query("CREATE DATABASE ??", [config.name]);

    // Select the freshly created schema on a new connection while the admin connection retains the reset lock.
    const connection = await mysql.createConnection({ ...connectionConfig, multipleStatements: true });
    try {
      await connection.query("USE ??", [name]);
      const migrations = fs
        .readdirSync(path.join(__dirname, "../../src/migrations"))
        .filter((file) => file.endsWith(".sql"))
        .sort();
      for (const migration of migrations) {
        await connection.query(fs.readFileSync(path.join(__dirname, "../../src/migrations", migration), "utf8"));
      }
      // Verify a migrated table before reporting the reset as successful.
      await connection.query("SELECT 1 FROM users LIMIT 1");
    } finally {
      await connection.end();
    }
  } finally {
    if (lockAcquired) await admin.query("SELECT RELEASE_LOCK(?)", [lockName]);
    await admin.end();
  }
}

async function resetTestDatabase() {
  // Serialize resets in-process; the database advisory lock also coordinates separate test workers.
  const current = resetQueue.then(performReset);
  resetQueue = current.catch(() => {});
  return current;
}

module.exports = { resetTestDatabase };
