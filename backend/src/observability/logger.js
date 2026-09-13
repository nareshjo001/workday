const SENSITIVE = /password|token|authorization|cookie|secret|document|attachment/i;

function redact(value, key = "") {
  if (SENSITIVE.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  }
  return value;
}

function write(level, event, fields = {}) {
  // One JSON object per line keeps logs searchable in local development and
  // compatible with ordinary container/platform log collectors.
  const target = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[target](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...redact(fields) }));
}

module.exports = {
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields),
  redact,
};
