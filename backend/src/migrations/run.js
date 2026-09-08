const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const env = require("../config/env");
const logger = require("../observability/logger");
const { connectWithRetry } = require("../utils/connectWithRetry");

async function run() {
  const dir = __dirname;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const connectionOptions = {
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
    database: env.db.name, multipleStatements: true,
  };
  const connection = await connectWithRetry(() => mysql.createConnection(connectionOptions), {
    attempts: env.startupDbRetries,
    delayMs: env.startupDbRetryMs,
    onRetry: ({ attempt, maxAttempts, error }) => logger.warn("migration_database_connection_retry", {
      attempt, max_attempts: maxAttempts, error_message: error.message,
    }),
  });

  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(128) NOT NULL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [appliedRows] = await connection.query("SELECT version, filename, checksum FROM schema_migrations");
    const applied = new Map(appliedRows.map((row) => [row.filename, row]));
    const baseline = process.argv.includes("--baseline-existing");
    if (baseline && applied.size) throw new Error("Cannot baseline a database that already has migration ledger entries.");
    const [[existingSchema]] = await connection.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'");
    if (!baseline && applied.size === 0 && Number(existingSchema.count) > 0) {
      throw new Error("Existing schema has no migration ledger. Verify it, take a backup, then run npm run migrate:baseline explicitly; migrations will not be replayed automatically.");
    }
    let appliedCount = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const existing = applied.get(file);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Migration checksum mismatch for ${file}; do not edit an applied migration.`);
        continue;
      }
      if (baseline) {
        await connection.query("INSERT INTO schema_migrations (version, filename, checksum) VALUES (?, ?, ?)", [file.slice(0, 3), file, checksum]);
        appliedCount += 1;
        logger.info("migration_baselined", { migration: file });
        continue;
      }
      logger.info("migration_applying", { migration: file });
      // MySQL DDL can implicitly commit. The ledger entry is deliberately
      // written only after the SQL succeeds; a failed migration therefore
      // remains visible and requires an operator's forward-fix/restore plan.
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (version, filename, checksum) VALUES (?, ?, ?)", [file.slice(0, 3), file, checksum]);
      appliedCount += 1;
    }
    logger.info("migrations_complete", { applied: appliedCount, baseline });
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  logger.error("migration_failed", { error_message: err.message });
  process.exit(1);
});
