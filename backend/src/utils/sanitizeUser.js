/**
 * Produces the safe, public representation of a user row.
 * Never include password_hash or any other sensitive field here.
 */
function sanitizeUser(userRow) {
  if (!userRow) return null;
  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role,
  };
}

module.exports = sanitizeUser;
