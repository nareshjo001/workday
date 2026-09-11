const INTELLIGENCE_CONTRACT_VERSION = "1";

const SEVERITIES = Object.freeze({
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

const SEVERITY_VALUES = Object.freeze(Object.values(SEVERITIES));

function normalizeSeverity(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return SEVERITY_VALUES.includes(normalized) ? normalized : null;
}

module.exports = { INTELLIGENCE_CONTRACT_VERSION, SEVERITIES, SEVERITY_VALUES, normalizeSeverity };
