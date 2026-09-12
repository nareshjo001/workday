const { pool } = require("../src/config/db");
const logger = require("../src/observability/logger");
const { runDueReminders } = require("../src/services/reminderService");

runDueReminders()
  .then((summary) => console.log(`REMINDER_RUN_SUMMARY ${JSON.stringify(summary)}`))
  .catch((error) => {
    logger.error("reminder_run_failed", { error_message: error.message });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
