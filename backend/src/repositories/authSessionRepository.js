async function create(conn, session) {
  await conn.query("INSERT INTO auth_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)", [session.id, session.userId, session.tokenHash, session.expiresAt]);
}
async function findActiveForUpdate(conn, tokenHash) {
  const [rows] = await conn.query("SELECT * FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE", [tokenHash]);
  return rows[0] || null;
}
async function findActiveById(id) {
  const { pool } = require("../config/db");
  const [rows] = await pool.query("SELECT id, user_id FROM auth_sessions WHERE id=? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1", [id]);
  return rows[0] || null;
}
async function revoke(conn, id, replacementId = null) {
  await conn.query("UPDATE auth_sessions SET revoked_at=NOW(), replaced_by_session_id=? WHERE id=? AND revoked_at IS NULL", [replacementId, id]);
}
async function revokeByTokenHash(conn, tokenHash) {
  await conn.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE token_hash=? AND revoked_at IS NULL", [tokenHash]);
}
async function revokeAllForUser(conn, userId) {
  await conn.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL", [userId]);
}
module.exports = { create, findActiveForUpdate, findActiveById, revoke, revokeByTokenHash, revokeAllForUser };
