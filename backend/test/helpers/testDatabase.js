const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Integration tests import this helper before the Express app in several
// files. Load the same untracked local .env contract explicitly so reset
// authentication never silently falls back to a blank password.
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

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

async function resetTestDatabase() {
  const config = testConfig();
  if (!config.password) throw new Error("Test database credentials are missing: set DB_PASSWORD in backend/.env; DB_NAME must end in _test.");
  const { name, ...connectionConfig } = config;
  const admin = await mysql.createConnection({ ...connectionConfig, multipleStatements: true });
  try {
    await admin.query("DROP DATABASE IF EXISTS ??", [config.name]);
    await admin.query("CREATE DATABASE ??", [config.name]);
  } finally {
    await admin.end();
  }

  const connection = await mysql.createConnection({ ...connectionConfig, database: name, multipleStatements: true });
  try {
    const migrations = fs
      .readdirSync(path.join(__dirname, "../../src/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const migration of migrations) {
      await connection.query(fs.readFileSync(path.join(__dirname, "../../src/migrations", migration), "utf8"));
    }
  } finally {
    await connection.end();
  }
}

module.exports = { resetTestDatabase };
