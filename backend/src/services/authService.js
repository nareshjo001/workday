const { pool } = require("../config/db");
const userRepository = require("../repositories/userRepository");
const clientCompanyRepository = require("../repositories/clientCompanyRepository");
const projectManagerRepository = require("../repositories/projectManagerRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const sanitizeUser = require("../utils/sanitizeUser");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../constants/roles");

/**
 * PM signup additionally finds-or-creates a client_companies row and
 * links the new user to it via project_managers — all in one transaction
 * with the user insert itself, so a failure partway through (e.g. the
 * company link) never leaves an orphaned user record with no company.
 * Vendor signup skips all of this (role !== PM).
 */
async function signup({ name, email, password, role, companyName }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const user = await userRepository.createUser({ name, email, passwordHash, role }, conn);

    if (role === ROLES.PM) {
      const companyId = await clientCompanyRepository.findOrCreate(conn, companyName);
      await projectManagerRepository.create(conn, { userId: user.id, companyId });
    }

    await conn.commit();
    return sanitizeUser(user);
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
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
