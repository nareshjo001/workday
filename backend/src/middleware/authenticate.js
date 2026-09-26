const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const authSessionRepository = require("../repositories/authSessionRepository");

// Verify the Bearer JWT and active session before attaching the authenticated identity.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Authentication token missing or malformed.");
  }

  try {
    const payload = verifyToken(token);
    if (!payload.sessionId) throw ApiError.unauthorized("Invalid authentication token.");
    const session = await authSessionRepository.findActiveById(payload.sessionId);
    if (!session || session.user_id !== payload.userId) throw ApiError.unauthorized("Session expired. Please log in again.");
    req.user = { userId: payload.userId, role: payload.role, sessionId: payload.sessionId };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }
    throw ApiError.unauthorized("Invalid authentication token.");
  }
});

module.exports = authenticate;
