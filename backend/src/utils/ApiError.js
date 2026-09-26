// Carry an HTTP status for safe responses from the central error handler.
class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code || "API_ERROR";
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details, "VALIDATION_ERROR");
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message, undefined, "UNAUTHORIZED");
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message, undefined, "FORBIDDEN");
  }
  static conflict(message) {
    return new ApiError(409, message, undefined, "CONFLICT");
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message, undefined, "NOT_FOUND");
  }
  static internal(message = "Internal server error") {
    return new ApiError(500, message, undefined, "INTERNAL_ERROR");
  }
}

module.exports = ApiError;
