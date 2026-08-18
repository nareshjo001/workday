const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Verifies the Bearer JWT on the Authorization header and attaches the
 * authenticated identity to req.user as { userId, role }.
 *
 * Pure authentication concern only — no business logic, no DB lookups.
 * Rejects: missing token, malformed header, invalid signature, expired token.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Authentication token missing or malformed.");
  }

  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }
    throw ApiError.unauthorized("Invalid authentication token.");
  }
});

module.exports = authenticate;
