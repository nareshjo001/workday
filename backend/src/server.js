const app = require("./app");
const env = require("./config/env");
const { testConnection } = require("./config/db");
const logger = require("./observability/logger");

async function start() {
  let lastError;
  for (let attempt = 1; attempt <= env.startupDbRetries; attempt += 1) {
    try {
      await testConnection();
      logger.info("database_connected", { attempt });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      logger.warn("database_connection_retry", { attempt, max_attempts: env.startupDbRetries, error_message: err.message });
      if (attempt < env.startupDbRetries) await new Promise((resolve) => setTimeout(resolve, env.startupDbRetryMs));
    }
  }
  if (lastError) {
    logger.error("database_connection_failed", { error_message: lastError.message, attempts: env.startupDbRetries });
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info("server_started", { port: env.port, environment: env.nodeEnv });
  });
}

start();
