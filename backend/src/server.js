const app = require("./app");
const env = require("./config/env");
const { testConnection } = require("./config/db");

async function start() {
  try {
    await testConnection();
    console.log("Database connection established.");
  } catch (err) {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`VMS backend listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start();
