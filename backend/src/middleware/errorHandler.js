const ApiError = require("../utils/ApiError");

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
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }

  // Unexpected error — log full detail server-side only.
  console.error("Unexpected error:", err);
  return res.status(500).json({ message: "Internal server error" });
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: "Route not found" });
}

module.exports = { errorHandler, notFoundHandler };
