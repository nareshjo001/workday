const userRepository = require("../repositories/userRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const sanitizeUser = require("../utils/sanitizeUser");
const ApiError = require("../utils/ApiError");

async function signup({ name, email, password, role }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.createUser({
    name,
    email,
    passwordHash,
    role,
  });

  return sanitizeUser(user);
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);

  // Intentionally generic: do not reveal whether the email exists.
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = signToken({ userId: user.id, role: user.role });

  return { token, user: sanitizeUser(user) };
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw ApiError.unauthorized("User no longer exists.");
  }
  return sanitizeUser(user);
}

module.exports = { signup, login, getCurrentUser };
