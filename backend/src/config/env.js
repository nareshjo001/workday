require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast at startup rather than at first use.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  db: {
    host: required("DB_HOST", "localhost"),
    port: Number(process.env.DB_PORT) || 3306,
    user: required("DB_USER", "root"),
    password: process.env.DB_PASSWORD || "",
    name: required("DB_NAME", "vms_db"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },

  invoice: {
    // Module 6: an invoice generated below this amount is AUTO_APPROVED;
    // at or above it, a PM must manually review it (see
    // invoiceService.determineInitialStatus). Configurable rather than
    // hard-coded in business logic, per the Module 6 spec — a config
    // value here, not a constant buried in invoiceService.js, so it can
    // be tuned per-deployment (.env) without a code change.
    autoApprovalThreshold: Number(process.env.INVOICE_AUTO_APPROVAL_THRESHOLD) || 10000,
  },
};

module.exports = env;
