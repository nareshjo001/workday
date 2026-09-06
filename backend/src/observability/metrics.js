const state = { counts: Object.create(null), latencyMs: Object.create(null) };
function increment(name) { state.counts[name] = (state.counts[name] || 0) + 1; }
function observe(name, value) { const entry = state.latencyMs[name] || { count: 0, total: 0 }; entry.count += 1; entry.total += value; state.latencyMs[name] = entry; }
function recordRequest(req, status, durationMs) {
  observe("http_request", durationMs);
  if (req.path.startsWith("/api/auth") && status >= 400) increment("auth_failure");
  if (req.path.includes("/assign") && status === 409) increment("assignment_conflict");
  if (req.path.includes("/pm/timesheets") && req.method === "PATCH" && status < 400) increment("timesheet_review");
  if (req.path.includes("/pm/timesheets") && req.method === "PATCH" && status < 400) increment("billing_trigger");
  if (req.path.includes("/invoices/") && req.method === "PATCH" && status < 400) increment("invoice_transition");
}
function snapshot() { return { counts: { ...state.counts }, latency_ms: Object.fromEntries(Object.entries(state.latencyMs).map(([key, value]) => [key, { ...value, average: value.total / value.count }])) }; }
function reset() { state.counts = Object.create(null); state.latencyMs = Object.create(null); }
module.exports = { increment, observe, recordRequest, snapshot, reset };
