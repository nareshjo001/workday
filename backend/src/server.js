const app = require("./app");
const env = require("./config/env");
const { testConnection } = require("./config/db");
const logger = require("./observability/logger");

async function start() {
  try {
    await testConnection();
    logger.info("database_connected");
  } catch (err) {
    logger.error("database_connection_failed", { error_message: err.message });
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info("server_started", { port: env.port, environment: env.nodeEnv });
  });
}

start();
