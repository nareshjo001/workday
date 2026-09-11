require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast at startup rather than at first use.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function featureEnabled(name) {
  return String(process.env[name] || "false").trim().toLowerCase() === "true";
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  startupDbRetries: Number(process.env.STARTUP_DB_RETRIES) || 30,
  startupDbRetryMs: Number(process.env.STARTUP_DB_RETRY_MS) || 1000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  corsOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean),

  db: {
    host: required("DB_HOST", "localhost"),
    port: Number(process.env.DB_PORT) || 3306,
    user: required("DB_USER", "root"),
    password: process.env.DB_PASSWORD || "",
    name: required("DB_NAME", "vms_db"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  },
  auth: {
    refreshExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 14,
    actionTokenExpiresMinutes: Number(process.env.ACTION_TOKEN_EXPIRES_MINUTES) || 30,
    maxFailedLogins: Number(process.env.AUTH_MAX_FAILED_LOGINS) || 5,
    lockoutMinutes: Number(process.env.AUTH_LOCKOUT_MINUTES) || 15,
  },
  storage: {
    documentRoot: process.env.DOCUMENT_STORAGE_PATH || "uploads/documents",
    uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024,
  },
  mail: {
    from: process.env.MAIL_FROM || "no-reply@vms.local",
    publicUrl: process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN || "http://localhost:5173",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || "",
    smtpPassword: process.env.SMTP_PASSWORD || "",
  },
  // Decision Intelligence is deliberately opt-in. These flags expose no
  // intelligence behaviour by themselves; later modules own their engines.
  intelligence: {
    vendorRateIntelligence: featureEnabled("INTELLIGENCE_VENDOR_RATE_ENABLED"),
    pmProjectControl: featureEnabled("INTELLIGENCE_PM_PROJECT_CONTROL_ENABLED"),
    contractorTimesheetIntelligence: featureEnabled("INTELLIGENCE_CONTRACTOR_TIMESHEET_ENABLED"),
    aiExplanations: featureEnabled("INTELLIGENCE_AI_EXPLANATIONS_ENABLED"),
  },
};

if (env.nodeEnv === "test" && !env.db.name.endsWith("_test")) {
  throw new Error("Refusing to run tests against a database whose name does not end in _test.");
}
if (env.nodeEnv === "production") {
  if (env.jwt.secret.length < 32 || /replace-with|changeme/i.test(env.jwt.secret)) throw new Error("JWT_SECRET must be a strong production secret of at least 32 characters.");
  if (!env.corsOrigins.length || env.corsOrigins.includes("*")) throw new Error("CLIENT_ORIGIN must be an explicit production allowlist.");
}

module.exports = env;
