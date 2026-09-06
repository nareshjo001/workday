async function revokeActive(conn, userId, purpose) {
  await conn.query("UPDATE auth_action_tokens SET revoked_at=NOW() WHERE user_id=? AND purpose=? AND used_at IS NULL AND revoked_at IS NULL", [userId, purpose]);
}
async function create(conn, token) {
  await conn.query("INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at) VALUES (?,?,?,?,?)", [token.id, token.userId, token.purpose, token.tokenHash, token.expiresAt]);
}
async function consumeForUpdate(conn, hash, purpose) {
  const [rows] = await conn.query("SELECT * FROM auth_action_tokens WHERE token_hash=? AND purpose=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE", [hash, purpose]);
  if (!rows[0]) return null;
  await conn.query("UPDATE auth_action_tokens SET used_at=NOW() WHERE id=?", [rows[0].id]);
  return rows[0];
}
module.exports = { revokeActive, create, consumeForUpdate };
