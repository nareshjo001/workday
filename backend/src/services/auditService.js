const repository = require("../repositories/auditRepository");

function write(conn, actor, action, entityType, entityId, before, after) {
  return repository.append(conn, {
    actorUserId: actor.userId,
    actorRole: actor.role,
    requestId: actor.requestId,
    action,
    entityType,
    entityId,
    before,
    after,
  });
}

module.exports = { write };
