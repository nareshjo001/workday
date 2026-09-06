const ApiError = require("../utils/ApiError");
const logger = require("../observability/logger");

/**
 * Centralized error-handling middleware. Every route/service throws
 * ApiError (or lets an unexpected error propagate) and this is the single
 * place responses are shaped — nothing else in the app should send its
 * own error JSON.
 *
 * Never leaks stack traces, SQL errors, or secrets to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      request_id: req.requestId,
    });
  }

  if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ code: "CONFLICT", message: "The requested change conflicts with existing data.", request_id: req.requestId });
  if (err?.code === "ER_NO_REFERENCED_ROW_2") return res.status(409).json({ code: "CONSTRAINT_VIOLATION", message: "The requested change violates a data constraint.", request_id: req.requestId });

  // Unexpected error — log full detail server-side only.
  logger.error("unhandled_error", { request_id: req.requestId, route: req.path, error_name: err?.name, error_code: err?.code, error_message: "[REDACTED]", stack: "[REDACTED]" });
  return res.status(500).json({ code: "INTERNAL_ERROR", message: "Internal server error", request_id: req.requestId });
}

function notFoundHandler(req, res) {
  res.status(404).json({ code: "ROUTE_NOT_FOUND", message: "Route not found", request_id: req.requestId });
}

module.exports = { errorHandler, notFoundHandler };
