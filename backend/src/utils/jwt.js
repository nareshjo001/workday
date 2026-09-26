const jwt = require("jsonwebtoken");
const env = require("../config/env");

// Include only identity and session claims needed for authentication.
function signToken({ userId, role, sessionId }) {
  return jwt.sign({ userId, role, sessionId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function verifyToken(token) {
  // Let authentication middleware translate verification failures into 401 responses.
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signToken, verifyToken };
