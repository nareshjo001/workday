const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Integration tests import this helper before the Express app in several
// files. Load the same untracked local .env contract explicitly so reset
// authentication never silently falls back to a blank password.
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

    // Open a second fresh connection without a selected schema, then select
    // the database only after the admin phase has committed CREATE DATABASE.
    // The admin connection remains open to hold the advisory lock until this
    // complete reset/migration sequence has finished.
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
      // Make a final query against a core migrated table so reset never
      // reports success while the new schema is unusable.
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
  // Every caller joins a real promise chain. Capturing a previous promise
  // and awaiting it is insufficient: two callers waiting on the same reset
  // may otherwise resume together. The advisory lock in performReset covers
  // separate Node test workers and coverage subprocesses.
  const current = resetQueue.then(performReset);
  resetQueue = current.catch(() => {});
  return current;
}

module.exports = { resetTestDatabase };
