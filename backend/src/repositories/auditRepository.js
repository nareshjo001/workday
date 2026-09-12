async function append(conn, record) {
  const [result] = await conn.query(
    "INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      record.actorUserId,
      record.actorRole,
      record.action,
      record.entityType,
      String(record.entityId),
      record.before ? JSON.stringify(record.before) : null,
      record.after ? JSON.stringify(record.after) : null,
      record.requestId || null,
    ]
  );
  return { id: result.insertId };
}

module.exports = { append };
