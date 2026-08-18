const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Reusable JWT utility. Payload is intentionally minimal — only what is
 * needed for authentication/authorization decisions.
 */
function signToken({ userId, role }) {
  return jwt.sign({ userId, role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function verifyToken(token) {
  // Throws jwt.TokenExpiredError / JsonWebTokenError on failure; caller
  // (auth middleware) is responsible for translating that into a 401.
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signToken, verifyToken };
