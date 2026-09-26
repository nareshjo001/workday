// Expose only public user fields, never password hashes.
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
