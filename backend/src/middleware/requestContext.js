const crypto = require("crypto");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

function requestContext(req, res, next) {
  const supplied = req.get("x-request-id");
  req.requestId = supplied && /^[A-Za-z0-9_-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    metrics.recordRequest(req, res.statusCode, durationMs);
    logger.info("http_request", { request_id: req.requestId, method: req.method, route: req.route?.path || req.path, status: res.statusCode, duration_ms: Number(durationMs.toFixed(2)), actor_user_id: req.user?.userId, actor_role: req.user?.role });
  });
  next();
}
module.exports = requestContext;
